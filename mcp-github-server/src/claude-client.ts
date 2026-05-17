import Anthropic from "@anthropic-ai/sdk";

import type { ClaudeContent } from "./types.js";

function normalizeSecret(rawValue?: string): string {
  const trimmed = rawValue?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  // Handle accidental quoting in env values, e.g. 'sk-ant-...' or "sk-ant-...".
  const hasMatchingQuotes =
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'));
  return hasMatchingQuotes ? trimmed.slice(1, -1).trim() : trimmed;
}

export function getAnthropicClient(): Anthropic {
  const apiKey = normalizeSecret(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  if (!apiKey.startsWith("sk-ant-")) {
    throw new Error(
      "ANTHROPIC_API_KEY has unexpected format. Provide a valid Anthropic API key without extra quotes.",
    );
  }

  return new Anthropic({ apiKey });
}

export function extractClaudeText(content: ClaudeContent): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
