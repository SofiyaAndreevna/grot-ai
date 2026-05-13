import 'dotenv/config';
import { createApp } from './app';
import { pool } from './db/pool';

const PORT = Number(process.env.PORT ?? 3001);
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log(`Received ${signal}, closing backend gracefully...`);

  server.close(async (serverCloseError) => {
    if (serverCloseError) {
      console.error('Failed to close HTTP server cleanly:', serverCloseError);
    }

    try {
      await pool.end();
    } catch (poolCloseError) {
      console.error('Failed to close PostgreSQL pool cleanly:', poolCloseError);
      process.exit(1);
      return;
    }

    process.exit(serverCloseError ? 1 : 0);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
