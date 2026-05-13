import { ApiError } from '../errors/ApiError';
import { pool } from '../db/pool';

const ChatMode = { analyst: 'analyst', developer:  'developer' } as const;
const DEFAULT_CHAT_TITLE = 'Новый чат';
const DEFAULT_CHAT_MODE = ChatMode.analyst;

type ChatMessage = {
  id: string;
  role: keyof typeof ChatMode;
  content: string;
};

type Chat = {
  id: string;
  title: string;
  mode: keyof typeof ChatMode;
  messages: ChatMessage[];
};

type EpicResponse = {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  chats: Chat[];
};

type EpicRow = {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  chats: unknown;
};

function toEpicResponse(row: EpicRow): EpicResponse {
  const chats = Array.isArray(row.chats) ? (row.chats as Chat[]) : [];

  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    chats,
  };
}

async function resolveProjectId(projectRef: string): Promise<string> {
  if (/^\d+$/.test(projectRef)) {
    return projectRef;
  }

  const byName = await pool.query<{ id: string }>(
    `
      SELECT id::text AS id
      FROM projects
      WHERE deleted_at IS NULL
        AND lower(name) = lower($1)
      LIMIT 1
    `,
    [projectRef],
  );

  if (byName.rows[0]?.id) {
    return byName.rows[0].id;
  }

  throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
}

export async function getEpicsByProjectId(projectRef: string): Promise<EpicResponse[]> {
  const projectId = await resolveProjectId(projectRef);

  const result = await pool.query<EpicRow>(
    `
      SELECT
        e.id::text AS id,
        e.project_id::text AS project_id,
        e.title,
        e.created_at::text AS created_at,
        e.updated_at::text AS updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id::text,
              'title', c.title
            )
            ORDER BY c.created_at ASC
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::json
        ) AS chats
      FROM epics e
      LEFT JOIN chats c
        ON c.epic_id = e.id
       AND c.deleted_at IS NULL
      WHERE e.project_id = $1::bigint
        AND e.deleted_at IS NULL
      GROUP BY e.id
      ORDER BY e.created_at ASC
    `,
    [projectId],
  );

  return result.rows.map(toEpicResponse);
}

type CreateEpicArgs = {
  projectId: string;
  name: string;
};

export async function createEpic({ projectId: projectRef, name }: CreateEpicArgs): Promise<EpicResponse> {
  const projectId = await resolveProjectId(projectRef);

  await pool.query('BEGIN');
  try {
    const epicResult = await pool.query<Omit<EpicRow, 'chats'>>(
      `
        INSERT INTO epics (project_id, title)
        VALUES ($1::bigint, $2)
        RETURNING id::text AS id, project_id::text AS project_id, title, created_at::text AS created_at, updated_at::text AS updated_at
      `,
      [projectId, name],
    );

    const defaultChatResult = await pool.query<Chat>(
      `
        INSERT INTO chats (epic_id, title, mode)
        VALUES ($1::bigint, $2, $3)
        RETURNING id::text AS id, title
      `,
      [epicResult.rows[0].id, DEFAULT_CHAT_TITLE, DEFAULT_CHAT_MODE],
    );

    await pool.query('COMMIT');

    return {
      ...toEpicResponse({ ...epicResult.rows[0], chats: [] }),
      chats: [defaultChatResult.rows[0]],
    };
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

type RenameEpicArgs = {
  epicId: string;
  name: string;
};

export async function renameEpic({ epicId, name }: RenameEpicArgs): Promise<EpicResponse | null> {
  const result = await pool.query<Omit<EpicRow, 'chats'>>(
    `
      UPDATE epics
      SET
        title = $2,
        updated_at = NOW()
      WHERE id = $1::bigint
        AND deleted_at IS NULL
      RETURNING id::text AS id, project_id::text AS project_id, title, created_at::text AS created_at, updated_at::text AS updated_at
    `,
    [epicId, name],
  );

  return result.rows[0] ? toEpicResponse({ ...result.rows[0], chats: [] }) : null;
}

export async function deleteEpic(epicId: string): Promise<boolean> {
  await pool.query('BEGIN');
  try {
    const epicResult = await pool.query(
      `
        UPDATE epics
        SET
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1::bigint
          AND deleted_at IS NULL
        RETURNING id
      `,
      [epicId],
    );

    if (!epicResult.rowCount) {
      await pool.query('ROLLBACK');
      return false;
    }

    await pool.query(
      `
        UPDATE chats
        SET
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE epic_id = $1::bigint
          AND deleted_at IS NULL
      `,
      [epicId],
    );

    await pool.query('COMMIT');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}
