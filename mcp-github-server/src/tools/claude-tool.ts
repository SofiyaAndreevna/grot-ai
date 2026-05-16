import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getAnthropicClient, extractClaudeText } from "../claude-client.js";
import { DEFAULT_CLAUDE_MODEL, MAX_FILE_BYTES } from "../constants.js";
import {
  buildContextBlock,
  buildRepoContexts,
} from "../repo-context.js";
import { asTextResponse } from "../text-response.js";

export function registerClaudeTool(server: McpServer): void {
  server.tool(
    "github_answer_with_claude",
    "Answer a user question using selected GitHub repositories and Claude",
    {
      context: z.object({
        gitHub: z.array(z.string().url()).min(1),
      }),
      message: z.string().min(1),
      model: z.string().default(DEFAULT_CLAUDE_MODEL),
      maxFilesPerRepo: z.number().int().min(1).max(10).default(3),
      maxBytesPerFile: z.number().int().min(1_000).max(MAX_FILE_BYTES).default(12_000),
      maxTokens: z.number().int().min(200).max(4_096).default(1_200),
    },
    async ({ context, message, model, maxFilesPerRepo, maxBytesPerFile, maxTokens }) => {
      const anthropic = getAnthropicClient();
      const repoUrls = [...new Set(context.gitHub.map((url) => url.trim()))];
      const repoContexts = await buildRepoContexts({
        repoUrls,
        message,
        maxFilesPerRepo,
        maxBytesPerFile,
      });

      const contextBlock = buildContextBlock(repoContexts);

      const claudeResponse = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: 0.2,
        system:
          "You are a GitHub code assistant. Answer only from the provided repository context. " +
          "If context is insufficient, clearly say what is missing. " +
          "Always include citations as clickable GitHub URLs for the key claims. " +
          "Answer in the same language as the user's question.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `User question:\n${message}\n\n` +
                  `Repositories context:\n${contextBlock}\n\n` +
                  "Provide a concise, practical answer with steps or code-level recommendations when relevant.",
              },
            ],
          },
        ],
      });

      const answer = extractClaudeText(claudeResponse.content);
      if (!answer) {
        throw new Error("Claude returned an empty response.");
      }

      return asTextResponse({
        question: message,
        model,
        usedRepositories: repoContexts.map((repoContext) => ({
          sourceUrl: repoContext.sourceUrl,
          fullName: repoContext.repoInfo.fullName,
          snippetsUsed: repoContext.snippets.length,
          hasReadme: Boolean(repoContext.readme),
        })),
        answer,
      });
    },
  );
}
