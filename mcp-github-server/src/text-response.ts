import type { ToolTextResponse } from "./types.js";

export function asTextResponse(value: unknown): ToolTextResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
