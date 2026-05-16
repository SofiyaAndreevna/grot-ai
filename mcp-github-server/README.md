# MCP GitHub Server

MCP server for fetching repository context from GitHub.

## Features

- `github_get_repo` - repository metadata
- `github_list_directory` - list files/folders in a path
- `github_get_file` - read file content from repo
- `github_search_code` - search code in selected repository
- `github_answer_with_claude` - take chat mode, question, optional web search/chat history, repo context, and answer with Claude using structured XML-like blocks

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
export CLAUDE_MODEL=claude-3-7-sonnet-latest # optional
export CLAUDE_TOOL_DEBUG=1 # optional: verbose logs for Claude rounds/tools
```

- `GITHUB_TOKEN`: recommended (higher GitHub API limits)
- `ANTHROPIC_API_KEY`: required for `github_answer_with_claude`
- `CLAUDE_MODEL`: optional override (defaults to `claude-3-7-sonnet-latest`)
- `CLAUDE_TOOL_DEBUG`: optional verbose progress logs to stderr (`1|true|yes|on`)

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
        "CLAUDE_MODEL": "claude-3-7-sonnet-latest"
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
        "CLAUDE_MODEL": "claude-3-7-sonnet-latest"
      }
    }
  }
}
```

## Tool input for backend payload

Use `github_answer_with_claude` with this payload shape:

```json
{
  "context": {
    "gitHub": [
      "https://github.com/owner/repo-a",
      "https://github.com/owner/repo-b"
    ],
    "webSearchSources": [
      {
        "url": "https://docs.mattermost.com/",
        "title": "Mattermost Docs",
        "description": "Official product documentation."
      }
    ]
  },
  "message": "Как подключить авторизацию OAuth?",
  "mode": "analyst",
  "webSearchResults": [
    {
      "url": "https://docs.mattermost.com/manage/user-management-configuration-settings.html",
      "title": "User management settings",
      "description": "How users are created and managed in Mattermost.",
      "text": "Users can be created through..."
    }
  ],
  "chatMessages": [
    {
      "role": "user",
      "content": "Мы говорили про роли пользователей?"
    },
    {
      "role": "assistant",
      "content": "Да, в прошлой ветке обсуждали..."
    }
  ],
  "task": "Answer the user's question. Use the sources you found. If there isn't enough data, tell them so.",
  "model": "claude-3-7-sonnet-latest",
  "maxFilesPerRepo": 3,
  "maxBytesPerFile": 12000,
  "maxTokens": 1200
}
```

Claude user prompt is assembled in this structure:

```xml
<chat_mode>analyst|developer</chat_mode>
<user_question>...</user_question>
<web_search_results>
  Allowed web sources (use only these sources):
  <source>url/title/description</source>
  Collected results:
  <source>url/title/description/text</source>
</web_search_results>
<chat_messages>...</chat_messages> <!-- optional -->
<md_files_content>...</md_files_content> <!-- system + mode markdown files -->
<repositories_context>...</repositories_context>
<task>...</task>
```

Response includes:
- final `answer` from Claude
- list of `usedRepositories` (which repos/snippets were used)
