import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import type {
  ActionResult,
  ClientToServerEvents,
  SeatResult,
  ServerToClientEvents,
} from './protocol.js';
import { registerHistoryRoutes } from './history/routes.js';
import type { HistoryStore } from './history/store.js';
import { TABLE, type Actor, type GameRoom } from './room.js';

const WEB_DIST = fileURLToPath(new URL('../../web/dist', import.meta.url));

/** What the server remembers about each connected screen. */
interface SocketData {
  /** The laptop itself: it may start and stop games and play for laptop players. */
  table: boolean;
  /** A phone's seat token, once it has joined. */
  token: string | null;
}

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export interface App {
  readonly fastify: FastifyInstance;
  readonly io: GameServer;
  readonly room: GameRoom;
}

const MAX_TOKEN_LENGTH = 100;

function isLoopback(address: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

/**
 * The address a screen connects from. In development the Vite proxy on this laptop sits in
 * between; it adds the real address as the last X-Forwarded-For entry. That header is only
 * trusted from the laptop itself, so a phone cannot pretend to be the laptop.
 */
export function clientAddress(direct: string, forwardedFor: string | string[] | undefined): string {
  if (!isLoopback(direct) || typeof forwardedFor !== 'string') return direct;
  return forwardedFor.split(',').at(-1)!.trim() || direct;
}

/** Only a screen on the laptop itself that says it is the game table is the table. */
function readHello(socket: GameSocket): SocketData {
  const hello = socket.handshake.auth as Record<string, unknown>;
  const address = clientAddress(
    socket.handshake.address,
    socket.handshake.headers['x-forwarded-for'],
  );
  const token = hello.token;
  return {
    table: hello.role === 'table' && isLoopback(address),
    token:
      hello.role === 'phone' &&
      typeof token === 'string' &&
      token.length > 0 &&
      token.length <= MAX_TOKEN_LENGTH
        ? token
        : null,
  };
}

export async function buildApp(options: {
  room: GameRoom;
  history: HistoryStore;
  serveWeb: boolean;
}): Promise<App> {
  const { room } = options;
  const fastify = Fastify({ logger: { level: 'warn' } });
  registerHistoryRoutes(fastify, options.history);

  if (options.serveWeb) {
    if (!existsSync(WEB_DIST)) {
      throw new Error(
        `Web app not built: ${WEB_DIST} is missing. Run "npm run build -w @yahtzee/web".`,
      );
    }
    await fastify.register(fastifyStatic, { root: WEB_DIST });
    // Client-side pages (/, /speler, /dashboard) all load the same index.html.
    fastify.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send();
    });
  }

  const io: GameServer = new Server(fastify.server, {
    // Notice a phone that dropped off the Wi-Fi within about 10 seconds.
    pingInterval: 5000,
    pingTimeout: 5000,
  });
  type Target = Pick<GameServer, 'emit'>;
  const sendYou = (socket: GameSocket) => {
    if (!socket.data.table) socket.emit('seat:you', room.playerFor(socket.data.token));
  };
  const sendAll = (target: Target) => {
    target.emit('game:theme', room.theme);
    target.emit('game:seats', room.seats);
    target.emit('game:state', room.state);
    target.emit('game:unfinished', room.unfinished);
    target.emit('history:saveFailed', room.saveFailed);
  };
  const broadcast = () => {
    sendAll(io);
    io.sockets.sockets.forEach(sendYou);
  };

  io.on('connection', (socket) => {
    socket.data = readHello(socket);
    if (socket.data.token) room.presence.connect(socket.data.token);
    sendAll(socket);
    sendYou(socket);
    // Everyone sees that this phone is back.
    if (socket.data.token) broadcast();

    socket.on('disconnect', () => {
      if (!socket.data.token) return;
      room.presence.disconnect(socket.data.token);
      broadcast();
    });

    /** From now on this phone plays with this token. */
    const useToken = (token: string) => {
      if (socket.data.token) room.presence.disconnect(socket.data.token);
      socket.data.token = token;
      room.presence.connect(token);
    };

    const actor = (): Actor =>
      socket.data.table ? TABLE : { kind: 'phone', token: socket.data.token };

    // Runs an intention, answers the sender and tells every screen about the new state.
    const handle = <R extends ActionResult | SeatResult>(ack: unknown, action: () => R) => {
      const result = action();
      if (typeof ack === 'function') (ack as (result: R) => void)(result);
      if (result.ok) broadcast();
    };
    // Starting, stopping and taking over turns are for the laptop only.
    const tableOnly =
      (action: () => ActionResult): (() => ActionResult) =>
      () =>
        socket.data.table ? action() : { ok: false, error: 'not_allowed' };
    // Payloads come from the network, so they are treated as unknown until the room checks them.
    const field = (payload: unknown, key: string): unknown =>
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)[key]
        : undefined;

    socket.on('game:create', (payload, ack) =>
      handle(
        ack,
        tableOnly(() => room.create(payload)),
      ),
    );
    socket.on('game:roll', (ack) => handle(ack, () => room.roll(actor())));
    socket.on('game:toggleHold', (payload, ack) =>
      handle(ack, () => room.toggleHold(field(payload, 'index'), actor())),
    );
    socket.on('game:chooseBox', (payload, ack) =>
      handle(ack, () => room.chooseBox(field(payload, 'box'), actor())),
    );
    socket.on('game:abort', (ack) =>
      handle(
        ack,
        tableOnly(() => room.abort()),
      ),
    );
    socket.on('game:rematch', (ack) =>
      handle(
        ack,
        tableOnly(() => room.rematch()),
      ),
    );
    socket.on('game:resume', (ack) =>
      handle(
        ack,
        tableOnly(() => room.resume()),
      ),
    );
    socket.on('game:discardUnfinished', (ack) =>
      handle(
        ack,
        tableOnly(() => room.discardUnfinished()),
      ),
    );
    socket.on('game:takeOver', (ack) =>
      handle(
        ack,
        tableOnly(() => room.takeOver()),
      ),
    );
    socket.on('seat:claim', (payload, ack) =>
      handle(ack, (): SeatResult => {
        if (socket.data.table) return { ok: false, error: 'not_allowed' };
        const result = room.claim(field(payload, 'playerId'));
        if (result.ok) useToken(result.token);
        return result;
      }),
    );
  });

  return { fastify, io, room };
}
