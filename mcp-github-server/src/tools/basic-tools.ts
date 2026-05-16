import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { DEFAULT_PER_PAGE, MAX_FILE_BYTES } from "../constants.js";
import { getGitHubFileContent, githubRequest } from "../github-client.js";
import { asTextResponse } from "../text-response.js";
import type {
  GitHubContentItem,
  GitHubFileResponse,
  GitHubSearchItem,
} from "../types.js";

export function registerBasicGitHubTools(server: McpServer): void {
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
      const { content, htmlUrl, isTrimmed, size } = await getGitHubFileContent({
        owner,
        repo,
        path,
        ref,
        maxBytes,
      });

      return asTextResponse({
        owner,
        repo,
        path,
        ref: ref ?? null,
        htmlUrl,
        size,
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
}
