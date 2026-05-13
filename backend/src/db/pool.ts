import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const parsedPoolMax = Number.parseInt(process.env.PG_POOL_MAX ?? '3', 10);
const poolMax = Number.isFinite(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : 3;

const ssl = connectionString
  ? {
      rejectUnauthorized: false,
    }
  : undefined;

const poolConfig = connectionString
  ? {
      connectionString,
      ssl,
      max: poolMax,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true,
    }
  : {
      max: poolMax,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true,
    };

declare global {
  // Reuse the same Pool when the runtime hot-reloads modules.
  // eslint-disable-next-line no-var
  var __grotPgPool: Pool | undefined;
}

export const pool = globalThis.__grotPgPool ?? new Pool(poolConfig);

if (!globalThis.__grotPgPool) {
  globalThis.__grotPgPool = pool;
}
