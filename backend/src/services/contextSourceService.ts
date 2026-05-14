import { pool } from '../db/pool';

type ContextSourceResponse = {
  id: string;
  projectId: string;
  type: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
};

type ContextSourceRow = {
  id: string;
  project_id: string;
  type: string;
  name: string;
  url: string;
  created_at: string;
  updated_at: string;
};

type CreateContextSourceArgs = {
  projectId: string;
  type: 'github';
  name: string;
  url: string;
};

type GetContextSourcesByProjectIdArgs = {
  projectId: string;
};

type DeleteContextSourceByIdArgs = {
  id: string;
};

function toContextSourceResponse(row: ContextSourceRow): ContextSourceResponse {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    name: row.name,
    url: row.url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createContextSource({
  projectId,
  type,
  name,
  url,
}: CreateContextSourceArgs): Promise<ContextSourceResponse> {
  const result = await pool.query<ContextSourceRow>(
    `
      INSERT INTO context_sources (project_id, type, name, url)
      VALUES ($1::bigint, $2, $3, $4)
      ON CONFLICT (project_id, type, url) WHERE deleted_at IS NULL AND url IS NOT NULL
      DO UPDATE
      SET
        name = EXCLUDED.name,
        updated_at = NOW(),
        deleted_at = NULL
      RETURNING
        id::text AS id,
        project_id::text AS project_id,
        type,
        name,
        url,
        created_at::text AS created_at,
        updated_at::text AS updated_at
    `,
    [projectId, type, name, url],
  );

  return toContextSourceResponse(result.rows[0]);
}

export async function getContextSourcesByProjectId({
  projectId,
}: GetContextSourcesByProjectIdArgs): Promise<ContextSourceResponse[]> {
  const result = await pool.query<ContextSourceRow>(
    `
      SELECT
        id::text AS id,
        project_id::text AS project_id,
        type,
        name,
        url,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      FROM context_sources
      WHERE project_id = $1::bigint
        AND deleted_at IS NULL
      ORDER BY updated_at DESC
    `,
    [projectId],
  );

  return result.rows.map(toContextSourceResponse);
}

export async function deleteContextSourceById({ id }: DeleteContextSourceByIdArgs): Promise<boolean> {
  const result = await pool.query(
    `
      UPDATE context_sources
      SET
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1::bigint
        AND deleted_at IS NULL
      RETURNING id
    `,
    [id],
  );

  return result.rowCount > 0;
}
