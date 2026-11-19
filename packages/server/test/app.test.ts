import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { GameState } from '@yahtzee/game-logic';
import { buildApp, type App } from '../src/app.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../src/protocol.js';
import { seededRng } from '../src/rng.js';
import { GameRoom } from '../src/room.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let app: App;
let clients: Client[] = [];

async function start(): Promise<string> {
  app = await buildApp({ room: new GameRoom(seededRng(1)), serveWeb: false });
  await app.fastify.listen({ port: 0, host: '127.0.0.1' });
  const { port } = app.fastify.server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

/** Connects and resolves with the client once the first state has arrived. */
function join(url: string): Promise<{ client: Client; states: (GameState | null)[] }> {
  const client: Client = connect(url, { transports: ['websocket'] });
  clients.push(client);
  const states: (GameState | null)[] = [];
  return new Promise((resolve) => {
    client.on('game:state', (state) => {
      states.push(state);
      if (states.length === 1) resolve({ client, states });
    });
  });
}

afterEach(async () => {
  clients.forEach((c) => c.disconnect());
  clients = [];
  app.io.close();
  await app.fastify.close();
});

describe('socket server', () => {
  it('sends the state on connect and broadcasts changes to every screen', async () => {
    const url = await start();
    const a = await join(url);
    const b = await join(url);
    expect(a.states).toEqual([null]);

    const result = await a.client.emitWithAck('game:create', { names: ['Emma', 'Sara'] });
    expect(result).toEqual({ ok: true });
    await expect.poll(() => b.states.length).toBe(2);
    expect(b.states[1]?.players.map((p) => p.name)).toEqual(['Emma', 'Sara']);

    expect(await a.client.emitWithAck('game:roll')).toEqual({ ok: true });
    await expect.poll(() => b.states[2]?.dice).toHaveLength(5);
  });

  it('answers bad intentions with an error and does not broadcast', async () => {
    const url = await start();
    const a = await join(url);
    await a.client.emitWithAck('game:create', { names: ['Emma', 'Sara'] });
    await a.client.emitWithAck('game:roll');
    await expect.poll(() => a.states.length).toBe(3);

    const send = a.client.emitWithAck.bind(a.client) as (...args: unknown[]) => Promise<unknown>;
    expect(await send('game:chooseBox', { box: 'bonus' })).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await send('game:chooseBox', null)).toEqual({ ok: false, error: 'invalid_input' });
    expect(await send('game:toggleHold', 'x')).toEqual({ ok: false, error: 'invalid_input' });
    expect(await send('game:create', { names: ['Noor', 'Lieke'] })).toEqual({
      ok: false,
      error: 'game_in_progress',
    });
    expect(a.states.length).toBe(3);
  });

  it('survives intentions sent without an acknowledgement callback', async () => {
    const url = await start();
    const a = await join(url);
    a.client.emit('game:create', { names: ['Emma', 'Sara'] } as never, undefined as never);
    await expect.poll(() => a.states.length).toBe(2);
    expect(app.room.state?.status).toBe('in_progress');
  });
});
