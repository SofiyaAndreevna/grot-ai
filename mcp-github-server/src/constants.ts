

export const GITHUB_API_URL = "https://api.github.com";
export const DEFAULT_PER_PAGE = 20;
export const MAX_FILE_BYTES = 120_000;
export const MAX_TOTAL_CONTEXT_CHARS = 90_000;
export const DEFAULT_CLAUDE_MODEL =
  process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-4-6";
