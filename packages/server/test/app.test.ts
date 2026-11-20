import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { GameState } from '@yahtzee/game-logic';
import { buildApp, clientAddress, type App } from '../src/app.js';
import type { GameList, GameDetail } from '../src/history/api.js';
import { openDatabase, type Database } from '../src/history/db.js';
import { HistoryStore } from '../src/history/store.js';
import type { GameSetup } from '../src/looks.js';
import type {
  ActionResult,
  ClientToServerEvents,
  LobbyState,
  SeatInfo,
  ServerToClientEvents,
  UnfinishedGame,
} from '../src/protocol.js';
import { seededRng } from '../src/rng.js';
import { GameRoom } from '../src/room.js';
import { FlakyHistory, always, lineup, memoryHistory, playTurn, ticking } from './helpers.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let app: App | undefined;
let clients: Client[] = [];

async function start(
  history: HistoryStore = memoryHistory(),
  room = new GameRoom(seededRng(1), { history }),
): Promise<string> {
  app = await buildApp({ room, history, serveWeb: false });
  await app.fastify.listen({ port: 0, host: '127.0.0.1' });
  const { port } = app.fastify.server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

/** Connects and resolves with the client once the first state has arrived. */
function join(url: string): Promise<{ client: Client; states: (GameState | null)[] }> {
  const client: Client = connect(url, { transports: ['websocket'], auth: { role: 'table' } });
  clients.push(client);
  const states: (GameState | null)[] = [];
  return new Promise((resolve) => {
    client.on('game:state', (state) => {
      states.push(state);
      if (states.length === 1) resolve({ client, states });
    });
  });
}

/** Sets up a game through the lobby, the way the laptop does. */
async function createGame(client: Client, setup: GameSetup): Promise<ActionResult> {
  const opened = await client.emitWithAck('lobby:open', { theme: setup.theme });
  if (!opened.ok) return opened;
  for (let n = 2; n < setup.players.length; n++) await client.emitWithAck('lobby:add');
  const ids = app!.lobby.state!.players.map((p) => p.id);
  for (const [i, change] of setup.players.entries()) {
    await client.emitWithAck('lobby:update', { id: ids[i]!, change });
  }
  return client.emitWithAck('lobby:start');
}

async function stop(): Promise<void> {
  clients.forEach((c) => c.disconnect());
  clients = [];
  if (!app) return;
  app.io.close();
  await app.fastify.close();
  app = undefined;
}

afterEach(stop);

describe('socket server', () => {
  it('sends the state on connect and broadcasts changes to every screen', async () => {
    const url = await start();
    const a = await join(url);
    const b = await join(url);
    expect(a.states).toEqual([null]);

    const result = await createGame(a.client, lineup(['Emma', 'Sara']));
    expect(result).toEqual({ ok: true });
    await expect.poll(() => b.states.at(-1)?.players.map((p) => p.name)).toEqual(['Emma', 'Sara']);

    expect(await a.client.emitWithAck('game:roll')).toEqual({ ok: true });
    await expect.poll(() => b.states.at(-1)?.dice).toHaveLength(5);
  });

  it('answers bad intentions with an error and does not broadcast', async () => {
    const url = await start();
    const a = await join(url);
    await createGame(a.client, lineup(['Emma', 'Sara']));
    await a.client.emitWithAck('game:roll');
    await expect.poll(() => a.states.at(-1)?.dice).toHaveLength(5);
    const seen = a.states.length;

    const send = a.client.emitWithAck.bind(a.client) as (...args: unknown[]) => Promise<unknown>;
    expect(await send('game:chooseBox', { box: 'bonus' })).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(await send('game:chooseBox', null)).toEqual({ ok: false, error: 'invalid_input' });
    expect(await send('game:toggleHold', 'x')).toEqual({ ok: false, error: 'invalid_input' });
    expect(await createGame(a.client, lineup(['Noor', 'Lieke']))).toEqual({
      ok: false,
      error: 'game_in_progress',
    });
    expect(a.states.length).toBe(seen);
  });

  it('sends the theme of the game before its state', async () => {
    const url = await start();
    const a = await join(url);
    const events: string[] = [];
    a.client.on('game:theme', (theme) => events.push(`theme:${theme}`));
    a.client.on('game:state', (state) => events.push(`state:${state?.status}`));
    await createGame(a.client, lineup(['Emma', 'Sara'], 'snoep'));
    await expect.poll(() => events.slice(-2)).toEqual(['theme:snoep', 'state:in_progress']);
  });

  it('survives intentions sent without an acknowledgement callback', async () => {
    const url = await start();
    const a = await join(url);
    a.client.emit('lobby:open', { theme: 'snoep' } as never, undefined as never);
    await expect.poll(() => app!.lobby.state?.theme).toBe('snoep');
  });
});

describe('who may act', () => {
  /** A phone: it connects with its seat token, if it has one. */
  function phone(url: string, token: string | null = null, headers: Record<string, string> = {}) {
    const client: Client = connect(url, {
      transports: ['websocket'],
      auth: { role: 'phone', token },
      extraHeaders: headers,
    });
    clients.push(client);
    const you: (string | null)[] = [];
    const seats: (readonly SeatInfo[])[] = [];
    client.on('seat:you', (id) => you.push(id));
    client.on('game:seats', (s) => seats.push(s));
    return { client, you, seats };
  }

  it('knows the address behind the development proxy, but only from the laptop itself', () => {
    expect(clientAddress('127.0.0.1', undefined)).toBe('127.0.0.1');
    expect(clientAddress('127.0.0.1', '127.0.0.1, 192.168.1.30')).toBe('192.168.1.30');
    expect(clientAddress('::1', '')).toBe('::1');
    expect(clientAddress('192.168.1.30', '127.0.0.1')).toBe('192.168.1.30');
    expect(clientAddress('::ffff:127.0.0.1', ['a', 'b'])).toBe('::ffff:127.0.0.1');
  });

  it('only lets the laptop start or stop a game', async () => {
    const url = await start();
    const p = phone(url);
    await expect.poll(() => p.you).toEqual([null]);
    expect(await createGame(p.client, lineup(['Emma', 'Sara']))).toEqual({
      ok: false,
      error: 'not_allowed',
    });

    // A phone behind the development proxy that says it is the table is still a phone.
    const proxied: Client = connect(url, {
      transports: ['websocket'],
      auth: { role: 'table' },
      extraHeaders: { 'x-forwarded-for': '192.168.1.30' },
    });
    clients.push(proxied);
    expect(await createGame(proxied, lineup(['Emma', 'Sara']))).toEqual({
      ok: false,
      error: 'not_allowed',
    });

    const table = await join(url);
    expect(await createGame(table.client, lineup(['Emma', 'Sara']))).toEqual({
      ok: true,
    });
    for (const event of ['game:abort', 'game:takeOver', 'game:rematch'] as const) {
      expect(await p.client.emitWithAck(event)).toEqual({ ok: false, error: 'not_allowed' });
    }
    expect(await table.client.emitWithAck('seat:claim', { playerId: 'x' })).toEqual({
      ok: false,
      error: 'not_allowed',
    });
  });

  it('lets a phone join the lobby and play its turns in the game', async () => {
    const url = await start(memoryHistory(), new GameRoom(always(6), { history: memoryHistory() }));
    const table = await join(url);
    const lobbies: (LobbyState | null)[] = [];
    table.client.on('lobby:state', (lobby) => lobbies.push(lobby));
    await table.client.emitWithAck('lobby:open', { theme: 'voetbal' });
    const emmaId = app!.lobby.state!.players[0]!.id;
    await table.client.emitWithAck('lobby:update', { id: emmaId, change: { name: 'Emma' } });

    const p = phone(url);
    const joined = await p.client.emitWithAck('lobby:join', {
      name: 'Sara',
      avatar: 'cat',
      colour: '#c62828',
    });
    expect(joined).toMatchObject({ ok: true });
    const saraId = (joined as { playerId: string }).playerId;
    await expect.poll(() => p.you.at(-1)).toBe(saraId);
    await expect
      .poll(() => lobbies.at(-1)?.players.map((pl) => [pl.name, pl.controller, pl.online]))
      .toEqual([
        ['Emma', 'table', true],
        ['Sara', 'phone', true],
      ]);
    expect(
      await p.client.emitWithAck('lobby:update', { id: saraId, change: { avatar: 'fox' } }),
    ).toEqual({ ok: true });
    for (const event of ['lobby:add', 'lobby:start', 'lobby:close'] as const) {
      expect(await p.client.emitWithAck(event)).toEqual({ ok: false, error: 'not_allowed' });
    }

    expect(await table.client.emitWithAck('lobby:start')).toEqual({ ok: true });
    await expect.poll(() => lobbies.at(-1)).toBeNull();
    await table.client.emitWithAck('game:roll');
    await table.client.emitWithAck('game:chooseBox', { box: 'sixes' });
    expect(await p.client.emitWithAck('game:roll')).toEqual({ ok: true });
    expect(await p.client.emitWithAck('game:toggleHold', { index: 1 })).toEqual({ ok: true });
    expect(await p.client.emitWithAck('game:chooseBox', { box: 'sixes' })).toEqual({ ok: true });
    await expect.poll(() => p.you.at(-1)).toBe(saraId);

    // Reordering and removing are for the laptop.
    await table.client.emitWithAck('game:abort');
    await table.client.emitWithAck('lobby:open', { theme: 'voetbal' });
    const ids = app!.lobby.state!.players.map((pl) => pl.id);
    expect(await table.client.emitWithAck('lobby:reorder', { ids: [ids[1]!, ids[0]!] })).toEqual({
      ok: true,
    });
    expect(await table.client.emitWithAck('lobby:remove', { id: ids[0]! })).toEqual({ ok: true });
  });

  it('lets a phone claim a player, play its turns and come back after a lost connection', async () => {
    const room = new GameRoom(always(6), { history: memoryHistory() });
    room.create(lineup(['Emma', 'Sara']));
    const url = await start(memoryHistory(), room);
    const table = await join(url);
    const [emma, sara] = room.state!.players;

    const first = phone(url);
    const claimed = await first.client.emitWithAck('seat:claim', { playerId: sara!.id });
    expect(claimed).toMatchObject({ ok: true, playerId: sara!.id });
    const token = (claimed as { token: string }).token;
    await expect.poll(() => first.you.at(-1)).toBe(sara!.id);
    await expect.poll(() => first.seats.at(-1)?.[1]?.controller).toBe('phone');

    // Emma's turn is on the laptop; Sara cannot play it.
    expect(await first.client.emitWithAck('game:roll')).toEqual({
      ok: false,
      error: 'not_your_turn',
    });
    await table.client.emitWithAck('game:roll');
    await table.client.emitWithAck('game:chooseBox', { box: 'sixes' });
    expect(await first.client.emitWithAck('game:roll')).toEqual({ ok: true });
    expect(room.state!.players[room.state!.currentPlayerIndex]).not.toBe(emma);

    // The phone drops off: the laptop sees it, and it comes back with its token.
    first.client.disconnect();
    await expect.poll(() => room.seats[1]?.online).toBe(false);
    const again = phone(url, token);
    await expect.poll(() => again.you.at(-1)).toBe(sara!.id);
    await expect.poll(() => room.seats[1]?.online).toBe(true);
    expect(await again.client.emitWithAck('game:chooseBox', { box: 'sixes' })).toEqual({
      ok: true,
    });
  });
});

describe('unfinished game after a restart', () => {
  let dir: string | undefined;
  let db: Database | undefined;
  afterEach(() => {
    db?.close();
    db = undefined;
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  /** Starts a server on a database file, like `npm start` does. */
  async function startOnFile(path: string): Promise<string> {
    db = openDatabase(path);
    const history = new HistoryStore(db);
    return start(history, new GameRoom(seededRng(1), { history, log: () => {} }));
  }

  async function joinWithUnfinished(url: string) {
    const unfinished: (UnfinishedGame | null)[] = [];
    const client: Client = connect(url, { transports: ['websocket'], auth: { role: 'table' } });
    clients.push(client);
    client.on('game:unfinished', (game) => unfinished.push(game));
    await expect.poll(() => unfinished.length).toBe(1);
    return { client, unfinished };
  }

  it('asks to continue or stop, and continues where the game was', async () => {
    dir = mkdtempSync(joinPath(tmpdir(), 'yahtzee-'));
    const path = joinPath(dir, 'yahtzee.db');

    let url = await startOnFile(path);
    const first = await join(url);
    await createGame(first.client, lineup(['Emma', 'Sara']));
    await first.client.emitWithAck('game:roll');
    await first.client.emitWithAck('game:toggleHold', { index: 2 });
    const before = app!.room.state;
    await stop();
    db!.close();
    db = undefined;

    url = await startOnFile(path);
    const second = await joinWithUnfinished(url);
    expect(second.unfinished[0]).toMatchObject({ round: 1 });
    expect(second.unfinished[0]!.players.map((p) => p.name)).toEqual(['Emma', 'Sara']);
    expect(await createGame(second.client, lineup(['Noor', 'Lieke']))).toEqual({
      ok: false,
      error: 'unfinished_game',
    });

    expect(await second.client.emitWithAck('game:resume')).toEqual({ ok: true });
    await expect.poll(() => second.unfinished.at(-1)).toBeNull();
    expect(app!.room.state).toEqual(before);
  });

  it('stops the unfinished game and saves it as aborted', async () => {
    dir = mkdtempSync(joinPath(tmpdir(), 'yahtzee-'));
    const path = joinPath(dir, 'yahtzee.db');
    let url = await startOnFile(path);
    const first = await join(url);
    await createGame(first.client, lineup(['Emma', 'Sara']));
    await first.client.emitWithAck('game:roll');
    await stop();
    db!.close();

    url = await startOnFile(path);
    const second = await joinWithUnfinished(url);
    expect(await second.client.emitWithAck('game:discardUnfinished')).toEqual({ ok: true });
    await expect.poll(() => second.unfinished.at(-1)).toBeNull();
    const list = (await app!.fastify.inject('/api/games')).json<GameList>();
    expect(list.items.map((g) => g.status)).toEqual(['aborted']);
  });
});

describe('save warning', () => {
  it('tells every screen when saving fails, and when it works again', async () => {
    const flaky = new FlakyHistory();
    const room = new GameRoom(always(1), { history: flaky, log: () => {} });
    const url = await start(flaky.inner, room);
    const client: Client = connect(url, { transports: ['websocket'], auth: { role: 'table' } });
    clients.push(client);
    const warnings: boolean[] = [];
    client.on('history:saveFailed', (failed) => warnings.push(failed));
    await expect.poll(() => warnings).toEqual([false]);

    await createGame(client, lineup(['Emma', 'Sara']));
    flaky.failing = true;
    await client.emitWithAck('game:roll');
    await expect.poll(() => warnings.at(-1)).toBe(true);
    flaky.failing = false;
    await client.emitWithAck('game:chooseBox', { box: 'ones' });
    await expect.poll(() => warnings.at(-1)).toBe(false);
  });
});

describe('history REST API', () => {
  async function withGames() {
    const history = memoryHistory();
    const room = new GameRoom(always(6), { history, now: ticking() });
    room.create(lineup(['Emma', 'Sara']));
    for (let turn = 0; turn < 26; turn++) playTurn(room);
    room.rematch();
    playTurn(room);
    room.abort();
    room.create(lineup(['Noor', 'Emma']));
    room.roll();
    await start(history, room);
    return { history, inject: app!.fastify.inject.bind(app!.fastify) };
  }

  it('lists games with filters, sorting and pages', async () => {
    const { inject } = await withGames();
    const all = (await inject('/api/games')).json<GameList>();
    expect(all).toMatchObject({ total: 3, page: 1, pageSize: 25 });
    expect(all.items.map((g) => g.status)).toEqual(['in_progress', 'aborted', 'finished']);

    const players = (await inject('/api/players')).json<{ id: string; name: string }[]>();
    const id = (name: string) => players.find((p) => p.name === name)!.id;
    const query = (q: string) => inject(`/api/games?${q}`).then((r) => r.json<GameList>());

    expect((await query(`player=${id('Emma')}&player=${id('Sara')}`)).total).toBe(2);
    expect((await query(`player=${id('Noor')}`)).total).toBe(1);
    expect((await query(`winner=${id('Emma')}`)).total).toBe(1);
    expect((await query('status=finished&playerCount=2')).total).toBe(1);
    expect((await query('minScore=100')).total).toBe(1);
    expect((await query('maxScore=99&from=2000-01-01&to=2999-12-31')).total).toBe(2);
    const best = await query('sort=score&order=desc&page=1&pageSize=1');
    expect(best).toMatchObject({ total: 3, pageSize: 1 });
    expect(best.items.map((g) => g.status)).toEqual(['finished']);
    const page3 = await query('sort=score&order=desc&page=3&pageSize=1');
    expect(page3.items[0]!.topScore).toBe(0);
  });

  it('refuses bad filters', async () => {
    const { inject } = await withGames();
    for (const q of ['from=19-11-2026', 'status=lost', 'playerCount=5', 'pageSize=500', 'page=0']) {
      expect((await inject(`/api/games?${q}`)).statusCode, q).toBe(400);
    }
  });

  it('shows a game and deletes only finished or aborted games', async () => {
    const { inject } = await withGames();
    const [busy, stopped] = (await inject('/api/games')).json<GameList>().items;

    const detail = (await inject(`/api/games/${stopped!.id}`)).json<GameDetail>();
    expect(detail.players.map((p) => p.name)).toEqual(['Emma', 'Sara']);
    expect(detail.players[0]!.scorecard.ones).toBe(0);
    expect((await inject('/api/games/nope')).statusCode).toBe(404);

    const remove = (id: string) => inject({ method: 'DELETE', url: `/api/games/${id}` });
    expect((await remove(busy!.id)).statusCode).toBe(409);
    expect((await remove(stopped!.id)).statusCode).toBe(204);
    expect((await remove(stopped!.id)).statusCode).toBe(404);
  });

  it('serves recent names and statistics', async () => {
    const { inject } = await withGames();
    const recent = (await inject('/api/players/recent')).json<{ name: string }[]>();
    expect(recent.map((p) => p.name)).toEqual(['Emma', 'Noor', 'Sara']);
    expect((await inject('/api/players/recent?limit=1')).json()).toHaveLength(1);
    expect((await inject('/api/players/recent?limit=0')).statusCode).toBe(400);

    const stats = (await inject('/api/stats/players')).json<{ name: string; gamesWon: number }[]>();
    expect(stats.map((s) => [s.name, s.gamesWon])).toEqual([
      ['Emma', 1],
      ['Sara', 1],
      ['Noor', 0],
    ]);
    expect((await inject('/api/stats/hall-of-fame?limit=1')).json()).toHaveLength(1);
    expect((await inject('/api/stats/games-per-month')).json()).toEqual([
      { month: expect.stringMatching(/^\d{4}-\d{2}$/), games: 3 },
    ]);
  });
});
