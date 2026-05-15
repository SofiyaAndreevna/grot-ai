import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerBasicGitHubTools } from "./tools/basic-tools.js";
import { registerClaudeTool } from "./tools/claude-tool.js";

const server = new McpServer({
  name: "github-context-server",
  version: "0.1.0",
});

registerBasicGitHubTools(server);
registerClaudeTool(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start MCP GitHub server:", error);
  process.exit(1);
});
