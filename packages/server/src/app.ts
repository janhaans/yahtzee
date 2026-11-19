import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import type { Ack, ActionResult, ClientToServerEvents, ServerToClientEvents } from './protocol.js';
import { GameRoom } from './room.js';

const WEB_DIST = fileURLToPath(new URL('../../web/dist', import.meta.url));

export interface App {
  readonly fastify: FastifyInstance;
  readonly io: Server<ClientToServerEvents, ServerToClientEvents>;
  readonly room: GameRoom;
}

export async function buildApp(options: { room: GameRoom; serveWeb: boolean }): Promise<App> {
  const { room } = options;
  const fastify = Fastify({ logger: { level: 'warn' } });

  if (options.serveWeb) {
    if (!existsSync(WEB_DIST)) {
      throw new Error(
        `Web app not built: ${WEB_DIST} is missing. Run "npm run build -w @yahtzee/web".`,
      );
    }
    await fastify.register(fastifyStatic, { root: WEB_DIST });
    // Client-side pages (/, /speler, /dashboard) all load the same index.html.
    fastify.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET') return reply.sendFile('index.html');
      return reply.code(404).send();
    });
  }

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(fastify.server);
  const broadcast = () => io.emit('game:state', room.state);

  io.on('connection', (socket) => {
    socket.emit('game:state', room.state);

    // Runs an intention, answers the sender and tells every screen about the new state.
    const handle = (ack: unknown, action: () => ActionResult) => {
      const result = action();
      if (typeof ack === 'function') (ack as Ack)(result);
      if (result.ok) broadcast();
    };
    // Payloads come from the network, so they are treated as unknown until the room checks them.
    const field = (payload: unknown, key: string): unknown =>
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)[key]
        : undefined;

    socket.on('game:create', (payload, ack) =>
      handle(ack, () => room.create(field(payload, 'names'))),
    );
    socket.on('game:roll', (ack) => handle(ack, () => room.roll()));
    socket.on('game:toggleHold', (payload, ack) =>
      handle(ack, () => room.toggleHold(field(payload, 'index'))),
    );
    socket.on('game:chooseBox', (payload, ack) =>
      handle(ack, () => room.chooseBox(field(payload, 'box'))),
    );
    socket.on('game:abort', (ack) => handle(ack, () => room.abort()));
    socket.on('game:rematch', (ack) => handle(ack, () => room.rematch()));
  });

  return { fastify, io, room };
}
