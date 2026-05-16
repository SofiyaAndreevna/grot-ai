import type Anthropic from "@anthropic-ai/sdk";

export type GitHubErrorPayload = {
  message?: string;
  documentation_url?: string;
};

export type GitHubContentItem = {
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

export type GitHubFileResponse = {
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

export type GitHubSearchItem = {
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

export type GitHubRepoResponse = {
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
};

export type ParsedGitHubRepoUrl = {
  sourceUrl: string;
  owner: string;
  repo: string;
};

export type RepoContext = {
  sourceUrl: string;
  owner: string;
  repo: string;
  repoInfo: {
    fullName: string;
    description: string | null;
    htmlUrl: string;
    defaultBranch: string;
  };
  readme: string | null;
  snippets: Array<{
    path: string;
    htmlUrl: string;
    content: string;
    isTrimmed: boolean;
  }>;
  note?: string;
};

export type ToolTextResponse = {
  content: Array<{
    type: "text";
    text: string;
  }>;
};

export type ClaudeContent = Anthropic.Messages.Message["content"];
