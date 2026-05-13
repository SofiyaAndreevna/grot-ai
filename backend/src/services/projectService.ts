import { pool } from '../db/pool';

type ProjectResponse = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

function toProjectResponse(row: ProjectRow): ProjectResponse {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type CreateProjectArgs = {
  id: string;
  name: string;
};

export async function getProjects(): Promise<ProjectResponse[]> {
  const result = await pool.query<ProjectRow>(
    `
      SELECT
        p.id::text AS id,
        p.name,
        p.created_at::text AS created_at,
        p.updated_at::text AS updated_at
      FROM projects p
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at ASC
    `,
  );

  return result.rows.map(toProjectResponse);
}

export async function createProject({ id, name }: CreateProjectArgs): Promise<ProjectResponse> {
  const sanitizedProvidedId = id.trim();
  const hasNumericProvidedId = /^\d+$/.test(sanitizedProvidedId);

  const result = hasNumericProvidedId
    ? await pool.query<ProjectRow>(
        `
          INSERT INTO projects (id, name)
          VALUES ($1::bigint, $2)
          RETURNING id::text AS id, name, created_at::text AS created_at, updated_at::text AS updated_at
        `,
        [sanitizedProvidedId, name],
      )
    : await pool.query<ProjectRow>(
        `
          INSERT INTO projects (name)
          VALUES ($1)
          RETURNING id::text AS id, name, created_at::text AS created_at, updated_at::text AS updated_at
        `,
        [name],
      );

  return toProjectResponse(result.rows[0]);
}

type UpdateProjectArgs = {
  id: string;
  name: string;
};

export async function updateProject({ id, name }: UpdateProjectArgs): Promise<ProjectResponse | null> {
  const result = await pool.query<ProjectRow>(
    `
      UPDATE projects
      SET
        name = $2,
        updated_at = NOW()
      WHERE id = $1::bigint
        AND deleted_at IS NULL
      RETURNING id::text AS id, name, created_at::text AS created_at, updated_at::text AS updated_at
    `,
    [id, name],
  );

  return result.rows[0] ? toProjectResponse(result.rows[0]) : null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const result = await pool.query(
    `
      UPDATE projects
      SET
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1::bigint
        AND deleted_at IS NULL
      RETURNING id
    `,
    [id],
  );

  return result.rowCount !== null && result.rowCount > 0;
}
