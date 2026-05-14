# MCP GitHub Server

MCP server for fetching repository context from GitHub.

## Features

- `github_get_repo` - repository metadata
- `github_list_directory` - list files/folders in a path
- `github_get_file` - read file content from repo
- `github_search_code` - search code in selected repository

## Setup

1. Install dependencies:

```bash
cd mcp-github-server
npm install
```

2. (Optional but recommended) set GitHub token:

```bash
export GITHUB_TOKEN=ghp_xxx
```

Without a token GitHub API rate limits are much lower.

3. Build:

```bash
npm run build
```

## Run

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm run start
```

## Cursor MCP config example

Add this server to your MCP config:

```json
{
  "mcpServers": {
    "github-context": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-github-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

For local development with tsx:

```json
{
  "mcpServers": {
    "github-context-dev": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/mcp-github-server/src/index.ts"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    }
  }
}
```
