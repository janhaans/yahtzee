import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { openDatabase } from './history/db.js';
import { HistoryStore } from './history/store.js';
import { createRng } from './rng.js';
import { GameRoom } from './room.js';

const config = readConfig(process.env);
if (config.seed !== null) {
  console.warn(`Using predictable dice (YAHTZEE_SEED=${config.seed}). Never used by npm start.`);
}

const db = openDatabase(config.dbPath);
const history = new HistoryStore(db);
const { fastify } = await buildApp({
  room: new GameRoom(createRng(config.seed), { history }),
  history,
  serveWeb: config.serveWeb,
});
await fastify.listen({ port: config.port, host: config.host });
console.log(`Yahtzee Party server on http://${config.host}:${config.port}`);
console.log(`Game history: ${config.dbPath}`);

// Close the database cleanly when the server is stopped (Ctrl+C).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void fastify.close().finally(() => {
      db.close();
      process.exit(0);
    });
  });
}
