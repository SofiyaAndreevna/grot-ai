import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAnthropicClient, extractClaudeText } from "../claude-client.js";
import { DEFAULT_CLAUDE_MODEL, DEFAULT_PER_PAGE, MAX_FILE_BYTES } from "../constants.js";
import { parseGitHubRepoUrl } from "../repo-context.js";
import { getGitHubFileContent, githubRequest } from "../github-client.js";
import type {
  GitHubContentItem,
  GitHubFileResponse,
  GitHubRepoResponse,
  GitHubSearchItem,
} from "../types.js";
import { asTextResponse } from "../text-response.js";

const CHAT_MODES = ["analyst", "developer"] as const;
type ChatMode = (typeof CHAT_MODES)[number];
const CHAT_SCENARIOS = ["questions", "feature_analysis"] as const;
type ChatScenario = (typeof CHAT_SCENARIOS)[number];
const CHAT_ROLES = ["user", "assistant", "system"] as const;

const webSourceSchema = z.object({
  url: z.string().url(),
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().min(1).max(2_000).optional(),
});

const webSearchResultSchema = webSourceSchema.extend({
  text: z.string().trim().min(1).max(12_000).optional(),
});

const chatMessageSchema = z.object({
  role: z.enum(CHAT_ROLES),
  content: z.string().trim().min(1).max(8_000),
});

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const promptDir = path.join(projectRoot, "src", "promt");
const baseSystemPrompt = readFileSync(
  path.join(promptDir, "system_prompt.md"),
  "utf8",
).trim();
const questionsAnalystPrompt = readFileSync(
  path.join(promptDir, "questions_analyst.md"),
  "utf8",
).trim();
const questionsDeveloperPrompt = readFileSync(
  path.join(promptDir, "questions_developer.md"),
  "utf8",
).trim();
const featureAnalysisAnalystPrompt = readFileSync(
  path.join(promptDir, "feature_analysis_analyst.md"),
  "utf8",
).trim();
const featureAnalysisDeveloperPrompt = readFileSync(
  path.join(promptDir, "feature_analysis_developer.md"),
  "utf8",
).trim();

function isVerboseClaudeLoggingEnabled(): boolean {
  const rawValue = process.env.CLAUDE_TOOL_DEBUG?.trim().toLowerCase();
  return rawValue === "1" || rawValue === "true" || rawValue === "yes" || rawValue === "on";
}

const isVerboseClaudeLogging = isVerboseClaudeLoggingEnabled();
const MAX_CLAUDE_CONTINUATION_ROUNDS = 3;
const MAX_CLAUDE_ANSWER_CHARS = 5_000;
const MAX_CLAUDE_CHAR_REWRITE_ROUNDS = 3;

function logClaudeProgress(message: string, details?: Record<string, unknown>): void {
  if (!isVerboseClaudeLogging) {
    return;
  }
  const timestamp = new Date().toISOString();
  if (details) {
    console.error(`[claude-tool][${timestamp}] ${message}`, details);
    return;
  }
  console.error(`[claude-tool][${timestamp}] ${message}`);
}

function buildAnswerLengthInstruction(): string {
  return `Final answer must be at most ${MAX_CLAUDE_ANSWER_CHARS} characters. Count all visible characters, including spaces and punctuation.`;
}

function resolveScenarioPrompt(mode: ChatMode, scenario: ChatScenario): { name: string; content: string } {
  if (scenario === "feature_analysis") {
    return mode === "developer"
      ? { name: "feature_analysis_developer.md", content: featureAnalysisDeveloperPrompt }
      : { name: "feature_analysis_analyst.md", content: featureAnalysisAnalystPrompt };
  }

  return mode === "developer"
    ? { name: "questions_developer.md", content: questionsDeveloperPrompt }
    : { name: "questions_analyst.md", content: questionsAnalystPrompt };
}

function resolveSystemPrompt(mode: ChatMode, scenario: ChatScenario): string {
  return `${baseSystemPrompt}\n\n${resolveScenarioPrompt(mode, scenario).content}`.trim();
}

function formatWebSearchSource(source: z.infer<typeof webSourceSchema>): string {
  return [
    "  <source>",
    `  url: ${source.url}`,
    `  title: ${source.title ?? "not provided"}`,
    `  description: ${source.description ?? "not provided"}`,
    "  </source>",
  ].join("\n");
}

function buildAllowedWebSources(
  allowedRepos: AllowedRepo[],
  explicitSources: z.infer<typeof webSourceSchema>[] | undefined,
): z.infer<typeof webSourceSchema>[] {
  if (explicitSources && explicitSources.length > 0) {
    return explicitSources;
  }

  return allowedRepos.map((repoContext) => ({
    url: repoContext.sourceUrl,
    title: `${repoContext.owner}/${repoContext.repo}`,
    description: "GitHub repository context source",
  }));
}

function buildWebSearchResultsBlock(
  webSearchResults: z.infer<typeof webSearchResultSchema>[] | undefined,
): string {
  if (!webSearchResults || webSearchResults.length === 0) {
    return "No web search results were provided.";
  }

  return webSearchResults
    .map((item) =>
      [
        "<source>",
        `url: ${item.url}`,
        `title: ${item.title ?? "not provided"}`,
        `description: ${item.description ?? "not provided"}`,
        "",
        "text:",
        item.text ?? "not provided",
        "</source>",
      ].join("\n"),
    )
    .join("\n\n");
}

function buildChatMessagesBlock(chatMessages: z.infer<typeof chatMessageSchema>[] | undefined): string {
  if (!chatMessages || chatMessages.length === 0) {
    return "";
  }

  const payload = chatMessages
    .map((item) => `<message role="${item.role}">\n${item.content}\n</message>`)
    .join("\n\n");

  return `<chat_messages>\n${payload}\n</chat_messages>\n\n`;
}

function buildMdFilesBlock(mode: ChatMode, scenario: ChatScenario): string {
  const scenarioPrompt = resolveScenarioPrompt(mode, scenario);
  return [
    "<md_files_content>",
    '<file name="system_prompt.md">',
    baseSystemPrompt,
    "</file>",
    "",
    `<file name="${scenarioPrompt.name}">`,
    scenarioPrompt.content,
    "</file>",
    "</md_files_content>",
  ].join("\n");
}

type AllowedRepo = {
  sourceUrl: string;
  owner: string;
  repo: string;
};

const repoSelectorSchema = z.object({
  owner: z.string().trim().min(1),
  repo: z.string().trim().min(1),
});

const listDirectoryInputSchema = repoSelectorSchema.extend({
  path: z.string().default(""),
  ref: z.string().trim().min(1).optional(),
});

const getFileInputSchema = repoSelectorSchema.extend({
  path: z.string().trim().min(1),
  ref: z.string().trim().min(1).optional(),
  maxBytes: z.number().int().min(1_000).max(MAX_FILE_BYTES).optional(),
});

const searchCodeInputSchema = repoSelectorSchema.extend({
  query: z.string().trim().min(1),
  path: z.string().trim().min(1).optional(),
  perPage: z.number().int().min(1).max(100).default(DEFAULT_PER_PAGE),
  page: z.number().int().min(1).default(1),
});

const claudeGitHubTools: Anthropic.Messages.Tool[] = [
  {
    name: "github_get_repo",
    description: "Get metadata about a GitHub repository.",
    input_schema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "github_list_directory",
    description: "List files and folders in a repository directory.",
    input_schema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string" },
        ref: { type: "string" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "github_get_file",
    description: "Read a text file from a GitHub repository.",
    input_schema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string" },
        ref: { type: "string" },
        maxBytes: { type: "number" },
      },
      required: ["owner", "repo", "path"],
    },
  },
  {
    name: "github_search_code",
    description: "Search code in a GitHub repository.",
    input_schema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        query: { type: "string" },
        path: { type: "string" },
        perPage: { type: "number" },
        page: { type: "number" },
      },
      required: ["owner", "repo", "query"],
    },
  },
];

function normalizeRepoKey(owner: string, repo: string): string {
  return `${owner.trim().toLowerCase()}/${repo.trim().toLowerCase()}`;
}

function buildRepositoryAccessBlock(allowedRepos: AllowedRepo[]): string {
  return [
    "You can use GitHub tools ONLY for these repositories:",
    ...allowedRepos.map((repo) => `- ${repo.owner}/${repo.repo} (${repo.sourceUrl})`),
    "",
    "Before answering repository/code questions, call GitHub tools to inspect actual files.",
    "Do not rely on assumptions when file inspection is possible.",
  ].join("\n");
}

function resolveAllowedRepo(
  allowedRepos: AllowedRepo[],
  owner: string,
  repo: string,
): AllowedRepo {
  const requestedKey = normalizeRepoKey(owner, repo);
  const matched = allowedRepos.find(
    (candidate) => normalizeRepoKey(candidate.owner, candidate.repo) === requestedKey,
  );
  if (!matched) {
    const allowed = allowedRepos
      .map((candidate) => `${candidate.owner}/${candidate.repo}`)
      .join(", ");
    throw new Error(
      `Repository ${owner}/${repo} is not allowed for this request. Allowed repositories: ${allowed}`,
    );
  }
  return matched;
}

async function executeClaudeGitHubTool(params: {
  toolName: string;
  toolInput: unknown;
  allowedRepos: AllowedRepo[];
  maxBytesPerFile: number;
  usedRepoKeys: Set<string>;
}): Promise<string> {
  const {
    toolName,
    toolInput,
    allowedRepos,
    maxBytesPerFile,
    usedRepoKeys,
  } = params;

  if (toolName === "github_get_repo") {
    const input = repoSelectorSchema.parse(toolInput);
    const repo = resolveAllowedRepo(allowedRepos, input.owner, input.repo);
    usedRepoKeys.add(normalizeRepoKey(repo.owner, repo.repo));
    const repoInfo = await githubRequest<GitHubRepoResponse>(
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`,
    );
    return JSON.stringify(repoInfo);
  }

  if (toolName === "github_list_directory") {
    const input = listDirectoryInputSchema.parse(toolInput);
    const repo = resolveAllowedRepo(allowedRepos, input.owner, input.repo);
    usedRepoKeys.add(normalizeRepoKey(repo.owner, repo.repo));
    const query = input.ref ? `?ref=${encodeURIComponent(input.ref)}` : "";
    const encodedPath = input.path
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const items = await githubRequest<GitHubContentItem[] | GitHubFileResponse>(
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/contents/${encodedPath}${query}`,
    );
    if (!Array.isArray(items)) {
      throw new Error(`Path "${input.path || "/"}" is a file, not a directory.`);
    }

    return JSON.stringify({
      owner: repo.owner,
      repo: repo.repo,
      path: input.path || "/",
      ref: input.ref ?? null,
      items: items.map((item) => ({
        type: item.type,
        name: item.name,
        path: item.path,
        size: item.size,
        htmlUrl: item.html_url,
      })),
    });
  }

  if (toolName === "github_get_file") {
    const input = getFileInputSchema.parse(toolInput);
    const repo = resolveAllowedRepo(allowedRepos, input.owner, input.repo);
    usedRepoKeys.add(normalizeRepoKey(repo.owner, repo.repo));
    const file = await getGitHubFileContent({
      owner: repo.owner,
      repo: repo.repo,
      path: input.path,
      ref: input.ref,
      maxBytes: Math.min(input.maxBytes ?? maxBytesPerFile, maxBytesPerFile),
    });

    return JSON.stringify({
      owner: repo.owner,
      repo: repo.repo,
      path: input.path,
      ref: input.ref ?? null,
      htmlUrl: file.htmlUrl,
      size: file.size,
      isTrimmed: file.isTrimmed,
      content: file.content,
    });
  }

  if (toolName === "github_search_code") {
    const input = searchCodeInputSchema.parse(toolInput);
    const repo = resolveAllowedRepo(allowedRepos, input.owner, input.repo);
    usedRepoKeys.add(normalizeRepoKey(repo.owner, repo.repo));
    const repoScope = `repo:${repo.owner}/${repo.repo}`;
    const pathScope = input.path ? ` path:${input.path}` : "";
    const queryParams = new URLSearchParams({
      q: `${input.query} ${repoScope}${pathScope}`,
      per_page: String(input.perPage),
      page: String(input.page),
    });

    const search = await githubRequest<{
      total_count: number;
      incomplete_results: boolean;
      items: GitHubSearchItem[];
    }>(`/search/code?${queryParams.toString()}`);

    return JSON.stringify({
      owner: repo.owner,
      repo: repo.repo,
      query: input.query,
      path: input.path ?? null,
      totalCount: search.total_count,
      incompleteResults: search.incomplete_results,
      page: input.page,
      perPage: input.perPage,
      items: search.items.map((item) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        htmlUrl: item.html_url,
        repo: item.repository.full_name,
        score: item.score,
      })),
    });
  }

  throw new Error(`Unknown tool requested by Claude: ${toolName}`);
}

function buildClaudeUserPrompt(params: {
  mode: ChatMode;
  scenario: ChatScenario;
  message: string;
  task: string;
  repositoriesAccessBlock: string;
  chatMessages?: z.infer<typeof chatMessageSchema>[];
  allowedWebSources: z.infer<typeof webSourceSchema>[];
  webSearchResults?: z.infer<typeof webSearchResultSchema>[];
}): string {
  const {
    mode,
    scenario,
    message,
    task,
    repositoriesAccessBlock,
    chatMessages,
    allowedWebSources,
    webSearchResults,
  } = params;
  const allowedSourcesText = allowedWebSources.length
    ? allowedWebSources.map((source) => formatWebSearchSource(source)).join("\n")
    : "  <source>\n  url: not provided\n  title: not provided\n  description: not provided\n  </source>";

  return [
    "<chat_mode>",
    mode,
    "</chat_mode>",
    "",
    "<chat_scenario>",
    scenario,
    "</chat_scenario>",
    "",
    "<user_question>",
    message,
    "</user_question>",
    "",
    "<web_search_results>",
    "Allowed web sources (use only these sources):",
    allowedSourcesText,
    "",
    "Collected results:",
    buildWebSearchResultsBlock(webSearchResults),
    "</web_search_results>",
    "",
    buildChatMessagesBlock(chatMessages).trimEnd(),
    buildMdFilesBlock(mode, scenario),
    "",
    "<repositories_access>",
    repositoriesAccessBlock,
    "</repositories_access>",
    "",
    "<task>",
    `${task}\n\n${buildAnswerLengthInstruction()}`,
    "</task>",
  ]
    .filter((part) => part.length > 0)
    .join("\n");
}

export function registerClaudeTool(server: McpServer): void {
  server.tool(
    "github_answer_with_claude",
    "Answer a user question using selected GitHub repositories and Claude",
    {
      context: z.object({
        gitHub: z.array(z.string().url()).min(1),
        webSearchSources: z.array(webSourceSchema).max(30).optional(),
      }),
      message: z.string().min(1),
      mode: z.enum(CHAT_MODES).default("analyst"),
      scenario: z.enum(CHAT_SCENARIOS).default("questions"),
      webSearchResults: z.array(webSearchResultSchema).max(30).optional(),
      chatMessages: z.array(chatMessageSchema).max(30).optional(),
      task: z
        .string()
        .trim()
        .min(1)
        .max(1_000)
        .default(
          "Answer the user's question. Use the sources you found. If there isn't enough data, tell them so.",
        ),
      model: z.string().default(DEFAULT_CLAUDE_MODEL),
      maxFilesPerRepo: z.number().int().min(1).max(10).default(3),
      maxBytesPerFile: z.number().int().min(1_000).max(MAX_FILE_BYTES).default(12_000),
      maxTokens: z.number().int().min(200).max(6001).default(2000),
      maxToolRounds: z.number().int().min(1).max(20).default(8),
    },
    async ({
      context,
      message,
      mode,
      scenario,
      webSearchResults,
      chatMessages,
      task,
      model,
      maxFilesPerRepo,
      maxBytesPerFile,
      maxTokens,
      maxToolRounds,
    }) => {
      const requestStartedAt = Date.now();
      const anthropic = getAnthropicClient();
      const repoUrls = [...new Set(context.gitHub.map((url) => url.trim()))];
      const allowedRepos = repoUrls.map((repoUrl) => parseGitHubRepoUrl(repoUrl));
      logClaudeProgress("Starting Claude request", {
        mode,
        scenario,
        model,
        repositories: allowedRepos.map((repo) => `${repo.owner}/${repo.repo}`),
        maxTokens,
        maxToolRounds,
      });
      const repositoriesAccessBlock = buildRepositoryAccessBlock(allowedRepos);
      const systemPrompt = resolveSystemPrompt(mode, scenario);
      const allowedWebSources = buildAllowedWebSources(allowedRepos, context.webSearchSources);
      const userPrompt = buildClaudeUserPrompt({
        mode,
        scenario,
        message,
        task,
        repositoriesAccessBlock,
        chatMessages,
        allowedWebSources,
        webSearchResults,
      });

      const messages: Anthropic.Messages.MessageParam[] = [
        {
          role: "user",
          content: userPrompt,
        },
      ];
      const usedRepoKeys = new Set<string>();
      let answer = "";
      let lastStopReason: string | null = null;

      for (let step = 0; step < maxToolRounds; step += 1) {
        const round = step + 1;
        const llmStartedAt = Date.now();
        logClaudeProgress("Calling Anthropic messages.create", {
          round,
          messagesCount: messages.length,
        });
        const claudeResponse = await anthropic.messages.create({
          model,
          max_tokens: maxTokens,
          temperature: 0.2,
          system: systemPrompt,
          tools: claudeGitHubTools,
          tool_choice: {
            type: "auto",
            disable_parallel_tool_use: false,
          },
          messages,
        });
        logClaudeProgress("Received Anthropic response", {
          round,
          durationMs: Date.now() - llmStartedAt,
          stopReason: claudeResponse.stop_reason,
          outputBlocks: claudeResponse.content.length,
        });
        lastStopReason = claudeResponse.stop_reason;

        messages.push({
          role: "assistant",
          content: claudeResponse.content as Anthropic.Messages.ContentBlockParam[],
        });

        const toolCalls = claudeResponse.content.filter(
          (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use",
        );

        if (toolCalls.length === 0) {
          answer = extractClaudeText(claudeResponse.content);
          logClaudeProgress("Claude returned final text answer", {
            round,
            answerChars: answer.length,
          });
          break;
        }

        logClaudeProgress("Claude requested GitHub tools", {
          round,
          toolCalls: toolCalls.map((toolCall) => toolCall.name),
        });
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
        for (const toolCall of toolCalls) {
          const toolStartedAt = Date.now();
          try {
            const toolOutput = await executeClaudeGitHubTool({
              toolName: toolCall.name,
              toolInput: toolCall.input,
              allowedRepos,
              maxBytesPerFile,
              usedRepoKeys,
            });
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: toolOutput,
            });
            logClaudeProgress("GitHub tool completed", {
              round,
              toolName: toolCall.name,
              durationMs: Date.now() - toolStartedAt,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown tool execution error.";
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              is_error: true,
              content: message,
            });
            logClaudeProgress("GitHub tool failed", {
              round,
              toolName: toolCall.name,
              durationMs: Date.now() - toolStartedAt,
              error: message,
            });
          }
        }

        messages.push({
          role: "user",
          content: toolResults,
        });
      }

      if (!answer) {
        logClaudeProgress("Tool rounds exhausted, requesting forced final answer", {
          durationMs: Date.now() - requestStartedAt,
          lastStopReason,
        });
        const forcedFinalPrompt =
          "Tool execution budget is exhausted. Provide the best possible final answer using the gathered context. " +
          "Do not request additional tools. " +
          buildAnswerLengthInstruction();
        const finalResponse = await anthropic.messages.create({
          model,
          max_tokens: maxTokens,
          temperature: 0.2,
          system: systemPrompt,
          messages: [
            ...messages,
            {
              role: "user",
              content: forcedFinalPrompt,
            },
          ],
        });
        messages.push({
          role: "user",
          content: forcedFinalPrompt,
        });
        messages.push({
          role: "assistant",
          content: finalResponse.content as Anthropic.Messages.ContentBlockParam[],
        });
        lastStopReason = finalResponse.stop_reason;
        answer = extractClaudeText(finalResponse.content);
      }

      if (lastStopReason === "max_tokens") {
        for (let continuationRound = 1; continuationRound <= MAX_CLAUDE_CONTINUATION_ROUNDS; continuationRound += 1) {
          logClaudeProgress("Claude stopped by max_tokens, requesting continuation", {
            continuationRound,
            maxContinuationRounds: MAX_CLAUDE_CONTINUATION_ROUNDS,
          });
          const continuationResponse = await anthropic.messages.create({
            model,
            max_tokens: maxTokens,
            temperature: 0.2,
            system: systemPrompt,
            messages: [
              ...messages,
              {
                role: "user",
                content:
                  "Continue your previous answer exactly from where it ended due to token limit. " +
                  "Do not repeat prior text. Start with the next sentence fragment. " +
                  buildAnswerLengthInstruction(),
              },
            ],
          });
          messages.push({
            role: "user",
            content:
              "Continue your previous answer exactly from where it ended due to token limit. " +
              "Do not repeat prior text. Start with the next sentence fragment. " +
              buildAnswerLengthInstruction(),
          });
          messages.push({
            role: "assistant",
            content: continuationResponse.content as Anthropic.Messages.ContentBlockParam[],
          });
          lastStopReason = continuationResponse.stop_reason;
          const continuationText = extractClaudeText(continuationResponse.content);
          if (continuationText) {
            answer = answer ? `${answer}\n${continuationText}` : continuationText;
            if (answer.length >= MAX_CLAUDE_ANSWER_CHARS) {
              break;
            }
          }
          if (lastStopReason !== "max_tokens") {
            break;
          }
        }
      }

      if (answer.length > MAX_CLAUDE_ANSWER_CHARS) {
        for (let rewriteRound = 1; rewriteRound <= MAX_CLAUDE_CHAR_REWRITE_ROUNDS; rewriteRound += 1) {
          logClaudeProgress("Answer exceeded character limit, requesting concise rewrite", {
            rewriteRound,
            maxRewriteRounds: MAX_CLAUDE_CHAR_REWRITE_ROUNDS,
            answerChars: answer.length,
            maxChars: MAX_CLAUDE_ANSWER_CHARS,
          });
          const rewritePrompt =
            `Your previous final answer is ${answer.length} characters long. ` +
            `Rewrite it so the new final answer is no longer than ${MAX_CLAUDE_ANSWER_CHARS} characters. ` +
            "Preserve key facts, structure, and caveats. Do not add new information.";
          const rewriteResponse = await anthropic.messages.create({
            model,
            max_tokens: maxTokens,
            temperature: 0.2,
            system: systemPrompt,
            messages: [
              ...messages,
              {
                role: "user",
                content: rewritePrompt,
              },
            ],
          });
          messages.push({
            role: "user",
            content: rewritePrompt,
          });
          messages.push({
            role: "assistant",
            content: rewriteResponse.content as Anthropic.Messages.ContentBlockParam[],
          });
          answer = extractClaudeText(rewriteResponse.content);
          if (answer.length <= MAX_CLAUDE_ANSWER_CHARS) {
            break;
          }
        }
        if (answer.length > MAX_CLAUDE_ANSWER_CHARS) {
          throw new Error(
            `Claude did not produce an answer within ${MAX_CLAUDE_ANSWER_CHARS} characters after rewrite attempts.`,
          );
        }
      }

      if (!answer) {
        logClaudeProgress("Claude did not return final answer", {
          durationMs: Date.now() - requestStartedAt,
          lastStopReason,
        });
        throw new Error(
          `Claude did not produce a final text answer. Last stop reason: ${lastStopReason ?? "unknown"}.`,
        );
      }

      logClaudeProgress("Finished Claude request", {
        durationMs: Date.now() - requestStartedAt,
      });
      return asTextResponse({
        question: message,
        model,
        usedRepositories: allowedRepos
          .filter((repo) => usedRepoKeys.has(normalizeRepoKey(repo.owner, repo.repo)))
          .map((repo) => ({
            sourceUrl: repo.sourceUrl,
            fullName: `${repo.owner}/${repo.repo}`,
          })),
        answer,
      });
    },
  );
}
