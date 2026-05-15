# MCP GitHub Server

MCP server for fetching repository context from GitHub.

## Features

- `github_get_repo` - repository metadata
- `github_list_directory` - list files/folders in a path
- `github_get_file` - read file content from repo
- `github_search_code` - search code in selected repository
- `github_answer_with_claude` - take `{ context.gitHub, message }`, collect relevant repo context, and answer with Claude

## Setup

1. Install dependencies:

```bash
cd mcp-github-server
npm install
```

2. Set environment variables:

```bash
export GITHUB_TOKEN=ghp_xxx
export ANTHROPIC_API_KEY=sk-ant-xxx
export CLAUDE_MODEL=claude-3-5-sonnet-latest # optional
```

- `GITHUB_TOKEN`: recommended (higher GitHub API limits)
- `ANTHROPIC_API_KEY`: required for `github_answer_with_claude`
- `CLAUDE_MODEL`: optional override (defaults to `claude-3-5-sonnet-latest`)

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
        "GITHUB_TOKEN": "ghp_xxx",
        "ANTHROPIC_API_KEY": "sk-ant-xxx",
        "CLAUDE_MODEL": "claude-3-5-sonnet-latest"
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
        "GITHUB_TOKEN": "ghp_xxx",
        "ANTHROPIC_API_KEY": "sk-ant-xxx",
        "CLAUDE_MODEL": "claude-3-5-sonnet-latest"
      }
    }
  }
}
```

## Tool input for backend payload

Use `github_answer_with_claude` with the same shape your backend already sends:

```json
{
  "context": {
    "gitHub": [
      "https://github.com/owner/repo-a",
      "https://github.com/owner/repo-b"
    ]
  },
  "message": "Как подключить авторизацию OAuth?",
  "model": "claude-3-5-sonnet-latest",
  "maxFilesPerRepo": 3,
  "maxBytesPerFile": 12000,
  "maxTokens": 1200
}
```

Response includes:
- final `answer` from Claude
- list of `usedRepositories` (which repos/snippets were used)
