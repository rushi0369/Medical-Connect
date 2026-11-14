import http from 'node:http';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

// A plain HTTP server, because Socket.IO attaches to this same server in Phase 7.
const server = http.createServer(app);

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${env.PORT} is already in use, so the backend cannot start. ` +
        `Close the other program using it, or change PORT in backend/.env.`,
    );
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(env.PORT, () => {
  console.log(`CK Medical API listening on http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
});

connectDatabase();

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();

  server.close();
  server.closeIdleConnections();
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
