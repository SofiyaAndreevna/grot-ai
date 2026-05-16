import {
  MAX_TOTAL_CONTEXT_CHARS,
} from "./constants.js";
import { getGitHubFileContent, githubRequest } from "./github-client.js";
import type {
  GitHubRepoResponse,
  GitHubSearchItem,
  ParsedGitHubRepoUrl,
  RepoContext,
} from "./types.js";

type BuildRepoContextsParams = {
  repoUrls: string[];
  message: string;
  maxFilesPerRepo: number;
  maxBytesPerFile: number;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "what",
  "where",
  "when",
  "как",
  "что",
  "где",
  "когда",
  "или",
  "для",
  "про",
]);

export function parseGitHubRepoUrl(url: string): ParsedGitHubRepoUrl {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }

  if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") {
    throw new Error(`URL must point to github.com: ${url}`);
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error(`Repository URL must include owner and repo: ${url}`);
  }

  return {
    sourceUrl: url,
    owner: segments[0],
    repo: segments[1].replace(/\.git$/i, ""),
  };
}

export function buildCodeSearchQuery(message: string): string {
  const parts = message
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

  const unique = [...new Set(parts)].slice(0, 8);
  if (unique.length === 0) {
    return "readme setup usage";
  }
  return unique.join(" ");
}

export async function buildRepoContexts(
  params: BuildRepoContextsParams,
): Promise<RepoContext[]> {
  const { repoUrls, message, maxFilesPerRepo, maxBytesPerFile } = params;
  const searchQuery = buildCodeSearchQuery(message);
  const repoContexts: RepoContext[] = [];
  let totalChars = 0;

  for (const repoUrl of repoUrls) {
    const { sourceUrl, owner, repo } = parseGitHubRepoUrl(repoUrl);
    const repoResponse = await githubRequest<GitHubRepoResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    );

    let readme: string | null = null;
    try {
      const readmeFile = await getGitHubFileContent({
        owner,
        repo,
        path: "README.md",
        ref: repoResponse.default_branch,
        maxBytes: Math.min(maxBytesPerFile, 8_000),
      });
      readme = readmeFile.content;
    } catch {
      readme = null;
    }

    const params = new URLSearchParams({
      q: `${searchQuery} repo:${owner}/${repo}`,
      per_page: String(maxFilesPerRepo),
      page: "1",
    });

    const codeSearch = await githubRequest<{
      items: GitHubSearchItem[];
    }>(`/search/code?${params.toString()}`);

    const snippets: RepoContext["snippets"] = [];
    for (const item of codeSearch.items.slice(0, maxFilesPerRepo)) {
      if (totalChars >= MAX_TOTAL_CONTEXT_CHARS) {
        break;
      }

      try {
        const file = await getGitHubFileContent({
          owner,
          repo,
          path: item.path,
          maxBytes: maxBytesPerFile,
        });
        snippets.push({
          path: item.path,
          htmlUrl: file.htmlUrl,
          content: file.content,
          isTrimmed: file.isTrimmed,
        });
        totalChars += file.content.length;
      } catch {
        // Skip unreadable/binary files and continue gathering context.
      }
    }

    repoContexts.push({
      sourceUrl,
      owner,
      repo,
      repoInfo: {
        fullName: repoResponse.full_name,
        description: repoResponse.description,
        htmlUrl: repoResponse.html_url,
        defaultBranch: repoResponse.default_branch,
      },
      readme,
      snippets,
      note:
        snippets.length === 0 && !readme
          ? "No readable context was extracted from this repository."
          : undefined,
    });

    if (totalChars >= MAX_TOTAL_CONTEXT_CHARS) {
      break;
    }
  }

  return repoContexts;
}

export function buildContextBlock(repoContexts: RepoContext[]): string {
  return repoContexts
    .map((repoContext) => {
      const snippetsText = repoContext.snippets
        .map(
          (snippet, index) =>
            `Snippet ${index + 1}\npath: ${snippet.path}\nurl: ${snippet.htmlUrl}\ntrimmed: ${snippet.isTrimmed}\ncontent:\n${snippet.content}`,
        )
        .join("\n\n---\n\n");

      return [
        `Repository: ${repoContext.repoInfo.fullName}`,
        `Source URL: ${repoContext.sourceUrl}`,
        `Description: ${repoContext.repoInfo.description ?? "n/a"}`,
        `Default branch: ${repoContext.repoInfo.defaultBranch}`,
        repoContext.readme
          ? `README excerpt:\n${repoContext.readme}`
          : "README excerpt: not available",
        snippetsText ? `Relevant files:\n${snippetsText}` : "Relevant files: not available",
        repoContext.note ? `Note: ${repoContext.note}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    })
    .join("\n\n==============================\n\n");
}
