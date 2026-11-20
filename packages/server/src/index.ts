import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { openDatabase } from './history/db.js';
import { HistoryStore } from './history/store.js';
import { findWifiInterfaces, joinAddresses } from './network.js';
import type { JoinAddress } from './protocol.js';
import { createRng } from './rng.js';
import { GameRoom } from './room.js';

const config = readConfig(process.env);
if (config.seed !== null) {
  console.warn(`Using predictable dice (YAHTZEE_SEED=${config.seed}). Never used by npm start.`);
}

const wifi = await findWifiInterfaces();
const join = (): JoinAddress[] => {
  if (config.publicUrl === null) return joinAddresses(config.joinPort, wifi);
  const url = new URL('/speler', config.publicUrl);
  return [{ name: 'PUBLIC_URL', kind: 'wifi', address: url.hostname, url: url.href }];
};

const db = openDatabase(config.dbPath);
const history = new HistoryStore(db);
const { fastify } = await buildApp({
  room: new GameRoom(createRng(config.seed), { history }),
  history,
  serveWeb: config.serveWeb,
  joinAddresses: join,
});
await fastify.listen({ port: config.port, host: config.host });
console.log(`Yahtzee Party server on http://${config.host}:${config.port}`);
console.log(`Game history: ${config.dbPath}`);
const [best, ...others] = join();
if (config.host === '127.0.0.1' && config.joinPort === config.port) {
  console.log('Phones cannot join: the server only listens on this laptop (HOST=127.0.0.1).');
} else if (best) {
  console.log(
    `Phones join at ${best.url}${others.length ? ` (or ${others.map((a) => a.url).join(', ')})` : ''}`,
  );
} else {
  console.log('No home network found: phones cannot join, but playing on the laptop works.');
}

// Close the database cleanly when the server is stopped (Ctrl+C).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void fastify.close().finally(() => {
      db.close();
      process.exit(0);
    });
  });
}
