import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { createRng } from './rng.js';
import { GameRoom } from './room.js';

const config = readConfig(process.env);
if (config.seed !== null) {
  console.warn(`Using predictable dice (YAHTZEE_SEED=${config.seed}). Never used by npm start.`);
}

const { fastify } = await buildApp({
  room: new GameRoom(createRng(config.seed)),
  serveWeb: config.serveWeb,
});
await fastify.listen({ port: config.port, host: config.host });
console.log(`Yahtzee Party server on http://${config.host}:${config.port}`);
