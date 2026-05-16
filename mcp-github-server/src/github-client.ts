import { GITHUB_API_URL } from "./constants.js";
import type {
  GitHubErrorPayload,
  GitHubFileResponse,
} from "./types.js";

type GetGitHubFileContentParams = {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  maxBytes: number;
};

type GitHubFileContent = {
  htmlUrl: string;
  size: number;
  isTrimmed: boolean;
  content: string;
};

function getAuthHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
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

export async function githubRequest<T>(path: string): Promise<T> {
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
    const docsLink = errorPayload?.documentation_url
      ? ` (${errorPayload.documentation_url})`
      : "";
    throw new Error(`GitHub API error ${response.status}: ${reason}${docsLink}`);
  }

  return (await response.json()) as T;
}

export async function getGitHubFileContent(
  params: GetGitHubFileContentParams,
): Promise<GitHubFileContent> {
  const { owner, repo, path, ref, maxBytes } = params;
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
    throw new Error(`File content unavailable for "${path}".`);
  }

  const normalized = file.content.replace(/\n/g, "");
  const decoded = decodeBase64(normalized);
  const { content, isTrimmed } = trimDecodedContent(decoded, maxBytes);

  return {
    htmlUrl: file.html_url,
    size: file.size,
    isTrimmed,
    content,
  };
}
