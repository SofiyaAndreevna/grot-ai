import { ApiError } from '../errors/ApiError';
import { pool } from '../db/pool';

const ChatMode = {
  analyst: 'analyst',
  developer: 'developer',
} as const;

const MessageRole = {
  user: 'user',
  assistant: 'assistant',
} as const;

const DEFAULT_CHAT_TITLE = 'Новый чат';
const DEFAULT_CHAT_MODE = ChatMode.analyst;

type ChatModeValue = keyof typeof ChatMode;

type ChatResponse = {
  id: string;
  epicId: string;
  title: string;
  mode: ChatModeValue;
  createdAt: string;
  updatedAt: string;
};

type ChatRow = {
  id: string;
  epic_id: string;
  title: string;
  mode: ChatModeValue;
  created_at: string;
  updated_at: string;
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
};

type CreateChatArgs = {
  epicId: string;
  title?: string;
  mode?: ChatModeValue;
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
  isModeLocked: boolean;
  messages: ChatMessageResponse[];
};

function toChatResponse(row: ChatRow): ChatResponse {
  return {
    id: row.id,
    epicId: row.epic_id,
    title: row.title,
    mode: row.mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSafeChatMode(mode?: ChatModeValue): ChatModeValue {
  return mode && mode in ChatMode ? mode : DEFAULT_CHAT_MODE;
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

export async function createChat({ epicId, title, mode }: CreateChatArgs): Promise<ChatResponse> {
  const result = await pool.query<ChatRow>(
    `
      INSERT INTO chats (epic_id, title, mode)
      VALUES ($1::bigint, $2, $3)
      RETURNING
        id::text AS id,
        epic_id::text AS epic_id,
        title,
        mode,
        created_at::text AS created_at,
        updated_at::text AS updated_at
    `,
    [epicId, title ?? DEFAULT_CHAT_TITLE, toSafeChatMode(mode)],
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
        created_at::text AS created_at,
        updated_at::text AS updated_at
    `,
    [chatId, title],
  );

  return result.rows[0] ? toChatResponse(result.rows[0]) : null;
}

export async function deleteChat(chatId: string): Promise<boolean> {
  await pool.query('BEGIN');
  try {
    const chatResult = await pool.query(
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
      await pool.query('ROLLBACK');
      return false;
    }

    await pool.query(
      `
        UPDATE chat_messages
        SET
          deleted_at = NOW()
        WHERE chat_id = $1::bigint
          AND deleted_at IS NULL
      `,
      [chatId],
    );

    await pool.query('COMMIT');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

export async function getChatMessages(chatId: string): Promise<ChatMessagesResponse> {
  const chatResult = await pool.query<
    Pick<ChatRow, 'mode'> & {
      id: string;
      has_user_messages: boolean;
    }
  >(
    `
      SELECT
        chats.id::text AS id,
        chats.mode AS mode,
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
    isModeLocked: chat.has_user_messages,
    messages: messagesResult.rows.map((row) => ({
      id: row.id,
      role: row.role,
      text: row.content,
      createdAt: row.created_at,
    })),
  };
}

export async function sendMessageToChat({ chatId, message, mode }: SendMessageArgs) {
  await pool.query('BEGIN');
  try {
    const chatResult = await pool.query<
      Pick<ChatRow, 'id' | 'title' | 'mode'> & {
        project_id: string;
        has_user_messages: boolean;
      }
    >(
      `
        SELECT
          chats.id::text AS id,
          chats.title AS title,
          chats.mode AS mode,
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
    const hasUserMessages = chat.has_user_messages;

    if (hasUserMessages && requestedMode && requestedMode !== chat.mode) {
      throw new ApiError(409, 'Chat mode is locked after first message', 'CHAT_MODE_LOCKED');
    }

    const activeMode = hasUserMessages ? chat.mode : toSafeChatMode(requestedMode ?? chat.mode);

    await pool.query(
      `
        INSERT INTO chat_messages (chat_id, role, content)
        VALUES ($1::bigint, $2, $3)
      `,
      [chatId, MessageRole.user, message],
    );

    const replyPayload = buildChatReply({
      message,
      topic: chat.title,
      mode: activeMode,
    });

    await pool.query(
      `
        INSERT INTO chat_messages (chat_id, role, content)
        VALUES ($1::bigint, $2, $3)
      `,
      [chatId, MessageRole.assistant, replyPayload.reply],
    );

    await pool.query(
      `
        UPDATE chats
        SET
          mode = CASE
            WHEN $3::boolean THEN mode
            ELSE $2
          END,
          updated_at = NOW()
        WHERE id = $1::bigint
      `,
      [chatId, activeMode, hasUserMessages],
    );

    await pool.query('COMMIT');

    return replyPayload;
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}
