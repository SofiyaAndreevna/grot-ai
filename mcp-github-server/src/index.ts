import { fileURLToPath } from "node:url";
import path from "node:path";

import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerBasicGitHubTools } from "./tools/basic-tools.js";
import { registerClaudeTool } from "./tools/claude-tool.js";

const currentFilePath = fileURLToPath(import.meta.url);
const envPath = path.resolve(path.dirname(currentFilePath), "..", ".env");
dotenv.config({ path: envPath });

const server = new McpServer({
  name: "github-context-server",
  version: "0.1.0",
});

registerBasicGitHubTools(server);
registerClaudeTool(server);

function isClaudeToolDebugEnabled(): boolean {
  const rawValue = process.env.CLAUDE_TOOL_DEBUG?.trim().toLowerCase();
  return rawValue === "1" || rawValue === "true" || rawValue === "yes" || rawValue === "on";
}

async function main() {
  console.error(
    `[startup] github-context-server starting (CLAUDE_TOOL_DEBUG=${isClaudeToolDebugEnabled()})`,
  );
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start MCP GitHub server:", error);
  process.exit(1);
});
