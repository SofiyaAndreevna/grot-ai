import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const GITHUB_API_URL = "https://api.github.com";
const DEFAULT_PER_PAGE = 20;
const MAX_FILE_BYTES = 120_000;

type GitHubErrorPayload = {
  message?: string;
  documentation_url?: string;
};

type GitHubContentItem = {
  type: "file" | "dir" | "submodule" | "symlink";
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
};

type GitHubFileResponse = {
  type: "file";
  encoding: "base64" | string;
  size: number;
  name: string;
  path: string;
  content?: string;
  download_url: string | null;
  html_url: string;
  sha: string;
};

type GitHubSearchItem = {
  name: string;
  path: string;
  sha: string;
  html_url: string;
  repository: {
    full_name: string;
    html_url: string;
  };
  score: number;
};

type ToolTextResponse = {
  content: Array<{
    type: "text";
    text: string;
  }>;
};

function getAuthHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function githubRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mcp-github-server",
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    let errorPayload: GitHubErrorPayload | null = null;
    try {
      errorPayload = (await response.json()) as GitHubErrorPayload;
    } catch {
      errorPayload = null;
    }

    const reason = errorPayload?.message ?? response.statusText;
    const docsLink = errorPayload?.documentation_url ? ` (${errorPayload.documentation_url})` : "";
    throw new Error(`GitHub API error ${response.status}: ${reason}${docsLink}`);
  }

  return (await response.json()) as T;
}

function asTextResponse(value: unknown): ToolTextResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function decodeBase64(value: string): string {
  return Buffer.from(value, "base64").toString("utf8");
}

function trimDecodedContent(content: string, maxBytes: number) {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes <= maxBytes) {
    return {
      isTrimmed: false,
      content,
    };
  }

  const ratio = maxBytes / bytes;
  const charLimit = Math.max(1, Math.floor(content.length * ratio));
  const trimmed = content.slice(0, charLimit);
  return {
    isTrimmed: true,
    content: trimmed,
  };
}

const server = new McpServer({
  name: "github-context-server",
  version: "0.1.0",
});

server.tool(
  "github_get_repo",
  "Get metadata about a GitHub repository",
  {
    owner: z.string().min(1),
    repo: z.string().min(1),
  },
  async ({ owner, repo }) => {
    const repoInfo = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    );
    return asTextResponse(repoInfo);
  },
);

server.tool(
  "github_list_directory",
  "List files in a repository directory",
  {
    owner: z.string().min(1),
    repo: z.string().min(1),
    path: z.string().default(""),
    ref: z.string().optional(),
  },
  async ({ owner, repo, path, ref }) => {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const encodedPath = path
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const items = await githubRequest<GitHubContentItem[] | GitHubFileResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${query}`,
    );

    if (!Array.isArray(items)) {
      throw new Error(`Path "${path || "/"}" is a file, not a directory.`);
    }

    const response = items.map((item) => ({
      type: item.type,
      name: item.name,
      path: item.path,
      size: item.size,
      htmlUrl: item.html_url,
    }));

    return asTextResponse({
      owner,
      repo,
      path: path || "/",
      ref: ref ?? null,
      items: response,
    });
  },
);

server.tool(
  "github_get_file",
  "Read a text file from a GitHub repository",
  {
    owner: z.string().min(1),
    repo: z.string().min(1),
    path: z.string().min(1),
    ref: z.string().optional(),
    maxBytes: z.number().int().min(1).max(MAX_FILE_BYTES).default(50_000),
  },
  async ({ owner, repo, path, ref, maxBytes }) => {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const encodedPath = path
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const file = await githubRequest<GitHubFileResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${query}`,
    );

    if (file.type !== "file") {
      throw new Error(`Path "${path}" is not a file.`);
    }

    if (file.encoding !== "base64" || !file.content) {
      return asTextResponse({
        owner,
        repo,
        path,
        ref: ref ?? null,
        note: "File content unavailable in API response. Use downloadUrl if needed.",
        downloadUrl: file.download_url,
        htmlUrl: file.html_url,
        size: file.size,
      });
    }

    const normalized = file.content.replace(/\n/g, "");
    const decoded = decodeBase64(normalized);
    const { content, isTrimmed } = trimDecodedContent(decoded, maxBytes);

    return asTextResponse({
      owner,
      repo,
      path,
      ref: ref ?? null,
      htmlUrl: file.html_url,
      size: file.size,
      isTrimmed,
      content,
    });
  },
);

server.tool(
  "github_search_code",
  "Search code in a specific GitHub repository",
  {
    owner: z.string().min(1),
    repo: z.string().min(1),
    query: z.string().min(1),
    path: z.string().optional(),
    perPage: z.number().int().min(1).max(100).default(DEFAULT_PER_PAGE),
    page: z.number().int().min(1).default(1),
  },
  async ({ owner, repo, query, path, perPage, page }) => {
    const repoScope = `repo:${owner}/${repo}`;
    const pathScope = path?.trim() ? ` path:${path.trim()}` : "";
    const combinedQuery = `${query.trim()} ${repoScope}${pathScope}`;

    const params = new URLSearchParams({
      q: combinedQuery,
      per_page: String(perPage),
      page: String(page),
    });

    const search = await githubRequest<{
      total_count: number;
      incomplete_results: boolean;
      items: GitHubSearchItem[];
    }>(`/search/code?${params.toString()}`);

    const items = search.items.map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      htmlUrl: item.html_url,
      repo: item.repository.full_name,
      score: item.score,
    }));

    return asTextResponse({
      owner,
      repo,
      query,
      path: path ?? null,
      totalCount: search.total_count,
      incompleteResults: search.incomplete_results,
      page,
      perPage,
      items,
    });
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start MCP GitHub server:", error);
  process.exit(1);
});
