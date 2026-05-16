import { ApiError } from '../errors/ApiError';
import { pool } from '../db/pool';
import { askGithubContext } from './githubContextService';

const ChatMode = {
  analyst: 'analyst',
  developer: 'developer',
} as const;

const ChatScenario = {
  questions: 'questions',
  feature_analysis: 'feature_analysis',
} as const;

const MessageRole = {
  user: 'user',
  assistant: 'assistant',
} as const;

const DEFAULT_CHAT_TITLE = 'Новый чат';
const DEFAULT_CHAT_MODE = ChatMode.analyst;
const DEFAULT_CHAT_SCENARIO = ChatScenario.questions;

type ChatModeValue = keyof typeof ChatMode;
type ChatScenarioValue = keyof typeof ChatScenario;

type ChatResponse = {
  id: string;
  epicId: string;
  title: string;
  mode: ChatModeValue;
  scenario: ChatScenarioValue;
  createdAt: string;
  updatedAt: string;
};

type ChatRow = {
  id: string;
  epic_id: string;
  title: string;
  mode: ChatModeValue;
  scenario: string;
  created_at: string;
  updated_at: string;
};

type ProjectGithubSourceRow = {
  url: string | null;
};

type BuildChatReplyParams = {
  message: string;
  topic?: string;
  mode: ChatModeValue;
};

type SendMessageArgs = {
  chatId: string;
  message: string;
  mode: ChatModeValue;
  scenario: ChatScenarioValue;
};

type CreateChatArgs = {
  epicId: string;
  title?: string;
  mode?: ChatModeValue;
  scenario?: ChatScenarioValue;
};

type RenameChatArgs = {
  chatId: string;
  title: string;
};

type ChatMessageRole = keyof typeof MessageRole;

type ChatMessageResponse = {
  id: string;
  role: ChatMessageRole;
  text: string;
  createdAt: string;
};

type ChatMessageRow = {
  id: string;
  role: ChatMessageRole;
  content: string;
  created_at: string;
};

type ChatMessagesResponse = {
  mode: ChatModeValue;
  scenario: ChatScenarioValue;
  isModeLocked: boolean;
  messages: ChatMessageResponse[];
};

function toChatResponse(row: ChatRow): ChatResponse {
  return {
    id: row.id,
    epicId: row.epic_id,
    title: row.title,
    mode: row.mode,
    scenario: toSafeChatScenario(row.scenario),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSafeChatMode(mode?: ChatModeValue): ChatModeValue {
  return mode && mode in ChatMode ? mode : DEFAULT_CHAT_MODE;
}

function isChatScenarioValue(value: string): value is ChatScenarioValue {
  return value in ChatScenario;
}

function toSafeChatScenario(scenario?: string): ChatScenarioValue {
  return scenario && isChatScenarioValue(scenario) ? scenario : DEFAULT_CHAT_SCENARIO;
}

export function buildChatReply({ message, topic, mode }: BuildChatReplyParams) {
  const trimmedMessage = message.trim();
  const safeTopic = typeof topic === 'string' && topic.trim() ? topic.trim() : 'Общий';

  return {
    reply: `Тема "${safeTopic}" (${mode}): получил вопрос "${trimmedMessage}". Это демо-ответ от backend на Express.`,
    timestamp: new Date().toISOString(),
    sources: [] as string[],
  };
}

export async function getChatsByEpicId(epicId: string): Promise<ChatResponse[]> {
  const result = await pool.query<ChatRow>(
    `
      SELECT
        c.id::text AS id,
        c.epic_id::text AS epic_id,
        c.title,
        c.mode,
        c.scenario,
        c.created_at::text AS created_at,
        c.updated_at::text AS updated_at
      FROM chats c
      WHERE c.epic_id = $1::bigint
        AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `,
    [epicId],
  );

  return result.rows.map(toChatResponse);
}

export async function createChat({ epicId, title, mode, scenario }: CreateChatArgs): Promise<ChatResponse> {
  const result = await pool.query<ChatRow>(
    `
      INSERT INTO chats (epic_id, title, mode, scenario)
      VALUES ($1::bigint, $2, $3, $4)
      RETURNING
        id::text AS id,
        epic_id::text AS epic_id,
        title,
        mode,
        scenario,
        created_at::text AS created_at,
        updated_at::text AS updated_at
    `,
    [epicId, title ?? DEFAULT_CHAT_TITLE, toSafeChatMode(mode), toSafeChatScenario(scenario)],
  );

  return toChatResponse(result.rows[0]);
}

export async function renameChat({ chatId, title }: RenameChatArgs): Promise<ChatResponse | null> {
  const result = await pool.query<ChatRow>(
    `
      UPDATE chats
      SET
        title = $2,
        updated_at = NOW()
      WHERE id = $1::bigint
        AND deleted_at IS NULL
      RETURNING
        id::text AS id,
        epic_id::text AS epic_id,
        title,
        mode,
        scenario,
        created_at::text AS created_at,
        updated_at::text AS updated_at
    `,
    [chatId, title],
  );

  return result.rows[0] ? toChatResponse(result.rows[0]) : null;
}

export async function deleteChat(chatId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const chatResult = await client.query(
      `
        UPDATE chats
        SET
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1::bigint
          AND deleted_at IS NULL
        RETURNING id
      `,
      [chatId],
    );

    if (!chatResult.rowCount) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      `
        UPDATE chat_messages
        SET
          deleted_at = NOW()
        WHERE chat_id = $1::bigint
          AND deleted_at IS NULL
      `,
      [chatId],
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getChatMessages(chatId: string): Promise<ChatMessagesResponse> {
  const chatResult = await pool.query<
    Pick<ChatRow, 'mode' | 'scenario'> & {
      id: string;
      has_user_messages: boolean;
    }
  >(
    `
      SELECT
        chats.id::text AS id,
        chats.mode AS mode,
        chats.scenario AS scenario,
        EXISTS (
          SELECT 1
          FROM chat_messages
          WHERE chat_id = chats.id
            AND role = '${MessageRole.user}'
            AND deleted_at IS NULL
        ) AS has_user_messages
      FROM chats
      WHERE chats.id = $1::bigint
        AND chats.deleted_at IS NULL
      LIMIT 1
    `,
    [chatId],
  );

  const chat = chatResult.rows[0];

  if (!chat) {
    throw new ApiError(404, 'Chat not found', 'CHAT_NOT_FOUND');
  }

  const messagesResult = await pool.query<ChatMessageRow>(
    `
      SELECT
        id::text AS id,
        role,
        content,
        created_at::text AS created_at
      FROM chat_messages
      WHERE chat_id = $1::bigint
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `,
    [chatId],
  );

  return {
    mode: chat.mode,
    scenario: toSafeChatScenario(chat.scenario),
    isModeLocked: chat.has_user_messages,
    messages: messagesResult.rows.map((row) => ({
      id: row.id,
      role: row.role,
      text: row.content,
      createdAt: row.created_at,
    })),
  };
}

export async function sendMessageToChat({ chatId, message, mode, scenario }: SendMessageArgs) {
  const client = await pool.connect();

  let activeMode: ChatModeValue = DEFAULT_CHAT_MODE;
  let activeScenario: ChatScenarioValue = DEFAULT_CHAT_SCENARIO;
  let githubUrls: string[] = [];

  try {
    await client.query('BEGIN');

    const chatResult = await client.query<
      Pick<ChatRow, 'id' | 'title' | 'mode' | 'scenario'> & {
        project_id: string;
        has_user_messages: boolean;
      }
    >(
      `
        SELECT
          chats.id::text AS id,
          chats.title AS title,
          chats.mode AS mode,
          chats.scenario AS scenario,
          epics.project_id::text AS project_id,
          EXISTS (
            SELECT 1
            FROM chat_messages
            WHERE chat_id = chats.id
              AND role = '${MessageRole.user}'
              AND deleted_at IS NULL
          ) AS has_user_messages
        FROM chats
        JOIN epics ON epics.id = chats.epic_id
        WHERE chats.id = $1::bigint
          AND chats.deleted_at IS NULL
          AND epics.deleted_at IS NULL
        LIMIT 1
      `,
      [chatId],
    );

    const chat = chatResult.rows[0];

    if (!chat) {
      throw new ApiError(404, 'Chat not found', 'CHAT_NOT_FOUND');
    }

    const requestedMode = mode ? toSafeChatMode(mode) : undefined;
    const requestedScenario = scenario ? toSafeChatScenario(scenario) : undefined;
    const hasUserMessages = chat.has_user_messages;
    const currentScenario = toSafeChatScenario(chat.scenario);

    if (hasUserMessages && requestedMode && requestedMode !== chat.mode) {
      throw new ApiError(409, 'Chat mode is locked after first message', 'CHAT_MODE_LOCKED');
    }

    if (hasUserMessages && requestedScenario && requestedScenario !== currentScenario) {
      throw new ApiError(409, 'Chat scenario is locked after first message', 'CHAT_SCENARIO_LOCKED');
    }

    activeMode = hasUserMessages ? chat.mode : toSafeChatMode(requestedMode ?? chat.mode);
    activeScenario = hasUserMessages
      ? currentScenario
      : toSafeChatScenario(requestedScenario ?? currentScenario);

    await client.query(
      `
        INSERT INTO chat_messages (chat_id, role, content)
        VALUES ($1::bigint, $2, $3)
      `,
      [chatId, MessageRole.user, message],
    );

    await client.query(
      `
        UPDATE chats
        SET
          mode = CASE
            WHEN $4::boolean THEN mode
            ELSE $2
          END,
          scenario = CASE
            WHEN $4::boolean THEN scenario
            ELSE $3
          END,
          updated_at = NOW()
        WHERE id = $1::bigint
      `,
      [chatId, activeMode, activeScenario, hasUserMessages],
    );

    const githubSourcesResult = await client.query<ProjectGithubSourceRow>(
      `
        SELECT url
        FROM context_sources
        WHERE project_id = $1::bigint
          AND type = 'github'
          AND deleted_at IS NULL
          AND url IS NOT NULL
        ORDER BY updated_at DESC
      `,
      [chat.project_id],
    );

    githubUrls = [...new Set(githubSourcesResult.rows.map((row) => row.url?.trim()).filter(Boolean))] as string[];

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  let replyPayload: {
    reply: string;
    timestamp: string;
    sources: string[];
  };

  if (githubUrls.length > 0) {
    console.log('activeMode', activeMode);
    console.log('activeScenario', activeScenario);
    try {
      const mcpResult = await askGithubContext({
        message,
        githubUrls,
        mode: activeMode,
        scenario: activeScenario,
      });
      replyPayload = {
        reply: mcpResult.answer,
        timestamp: new Date().toISOString(),
        sources: mcpResult.sources.length > 0 ? mcpResult.sources : githubUrls,
      };
    } catch (mcpError) {
      console.error('Failed to fetch response from MCP GitHub server:', mcpError);
      replyPayload = {
        reply:
          'Не получилось получить ответ от MCP GitHub сервера. ' +
          'Проверьте, что `mcp-github-server` собран и запущен, а токены настроены.',
        timestamp: new Date().toISOString(),
        sources: githubUrls,
      };
    }
  } else {
    replyPayload = {
      reply:
        'Для этого проекта пока нет GitHub источников контекста. ' +
        'Добавьте `context_source` с type `github`, чтобы я мог отвечать по коду репозиториев.',
      timestamp: new Date().toISOString(),
      sources: [],
    };
  }

  await pool.query(
    `
      INSERT INTO chat_messages (chat_id, role, content)
      VALUES ($1::bigint, $2, $3)
    `,
    [chatId, MessageRole.assistant, replyPayload.reply],
  );

  return replyPayload;
}
