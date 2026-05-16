import { existsSync } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const GITHUB_TOOL_NAME = 'github_answer_with_claude';
const DEFAULT_MCP_COMMAND = 'node';
const DEFAULT_MCP_REQUEST_TIMEOUT_MS = 180_000_000;
const DEFAULT_MCP_SCRIPT_PATH = path.resolve(
  process.cwd(),
  '..',
  'mcp-github-server',
  'dist',
  'index.js',
);
const FALLBACK_MCP_SCRIPT_PATH = path.resolve(
  process.cwd(),
  'mcp-github-server',
  'dist',
  'index.js',
);

type GitHubAnswerPayload = {
  context: {
    gitHub: string[];
  };
  message: string;
  mode: string;
};

type McpToolTextContent = {
  type: string;
  text?: string;
};

type McpToolResult = {
  content?: McpToolTextContent[];
  isError?: boolean;
};

type GithubAnswerToolResponse = {
  answer: string;
  usedRepositories?: Array<{
    sourceUrl?: string;
  }>;
};

export type GithubContextReply = {
  answer: string;
  sources: string[];
};

function resolveMcpRequestTimeoutMs(): number {
  const rawValue = process.env.MCP_GITHUB_REQUEST_TIMEOUT_MS?.trim();
  if (!rawValue) {
    return DEFAULT_MCP_REQUEST_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MCP_REQUEST_TIMEOUT_MS;
  }

  return parsed;
}

function resolveMcpScriptPath(): string {
  const fromEnv = process.env.MCP_GITHUB_SERVER_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  }

  if (existsSync(DEFAULT_MCP_SCRIPT_PATH)) {
    return DEFAULT_MCP_SCRIPT_PATH;
  }

  if (existsSync(FALLBACK_MCP_SCRIPT_PATH)) {
    return FALLBACK_MCP_SCRIPT_PATH;
  }

  return DEFAULT_MCP_SCRIPT_PATH;
}

function parseMcpToolResult(result: McpToolResult): GithubContextReply {
  const textPayload = result.content?.find((item) => item.type === 'text')?.text;
  if (!textPayload) {
    throw new Error('MCP tool returned an empty payload.');
  }

  const parsed = JSON.parse(textPayload) as Partial<GithubAnswerToolResponse>;
  if (typeof parsed.answer !== 'string' || !parsed.answer.trim()) {
    throw new Error('MCP tool response does not contain a valid answer.');
  }

  const sources =
    parsed.usedRepositories
      ?.map((repo) => repo.sourceUrl?.trim())
      .filter((sourceUrl): sourceUrl is string => Boolean(sourceUrl)) ?? [];

  return {
    answer: parsed.answer.trim(),
    sources,
  };
}

function extractMcpError(result: McpToolResult): string {
  const rawText = result.content?.find((item) => item.type === 'text')?.text?.trim();
  if (!rawText) {
    return 'No error payload provided by MCP tool.';
  }

  try {
    const parsed = JSON.parse(rawText) as {
      error?: unknown;
      message?: unknown;
    };
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error.trim();
    }
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // Ignore JSON parse errors and fallback to raw text.
  }

  return rawText;
}

function explainMcpAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid x-api-key')) {
    return (
      'Anthropic authentication failed: ANTHROPIC_API_KEY is invalid or malformed. ' +
      'Update the key in environment variables and restart backend.'
    );
  }
  if (normalized.includes('not_found_error') && normalized.includes('model:')) {
    return (
      'Anthropic model not found. Configure a supported value in CLAUDE_MODEL ' +
      '(for example, claude-3-7-sonnet-latest) and restart services.'
    );
  }
  return message;
}

export async function askGithubContext({
  message,
  githubUrls,
  mode,
}: {
  message: string;
  githubUrls: string[];
  mode: string;
}): Promise<GithubContextReply> {
  const requestTimeoutMs = resolveMcpRequestTimeoutMs();
  const payload: GitHubAnswerPayload = {
    context: {
      gitHub: githubUrls,
    },
    message,
    mode,
  };

  const mcpScriptPath = resolveMcpScriptPath();
  if (!existsSync(mcpScriptPath)) {
    throw new Error(
      `MCP GitHub server entrypoint not found at "${mcpScriptPath}". ` +
        'Set MCP_GITHUB_SERVER_PATH or build mcp-github-server first.',
    );
  }
  const transport = new StdioClientTransport({
    command: process.env.MCP_GITHUB_SERVER_COMMAND?.trim() || DEFAULT_MCP_COMMAND,
    args: [mcpScriptPath],
    env: Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
  });
  const client = new Client(
    {
      name: 'grot-backend',
      version: '1.0.0',
    },
    {
      capabilities: {},
    },
  );

  await client.connect(transport);
  try {
    const result = (await client.callTool(
      {
        name: GITHUB_TOOL_NAME,
        arguments: payload,
      },
      undefined,
      {
        timeout: requestTimeoutMs,
      },
    )) as McpToolResult;

    if (result.isError) {
      const extracted = extractMcpError(result);
      throw new Error(`MCP GitHub tool returned an error: ${explainMcpAuthError(extracted)}`);
    }

    return parseMcpToolResult(result);
  } finally {
    await transport.close();
  }
}
