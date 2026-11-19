import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createGame,
  emptyScorecard,
  type GameState,
  type GameStatus,
  type Scorecard,
} from '@yahtzee/game-logic';
import { openDatabase, transaction } from '../src/history/db.js';
import { HistoryStore, type GameRecord } from '../src/history/store.js';
import { amsterdamMonth, dayStartUtc } from '../src/history/time.js';
import { memoryHistory } from './helpers.js';

interface Spec {
  id: string;
  names: string[];
  /** Final score per player, put in the Chance box. */
  scores?: number[];
  status?: GameStatus;
  startedAt?: string;
  minutes?: number;
  yahtzees?: { seat: number; box: number; bonus: number };
}

/** A finished card has all 13 boxes filled (0 except Chance); other cards only Chance. */
function cardWith(score: number, full: boolean): Scorecard {
  const empty = emptyScorecard().boxes;
  const boxes = full
    ? (Object.fromEntries(Object.keys(empty).map((box) => [box, 0])) as Scorecard['boxes'])
    : empty;
  return { boxes: { ...boxes, chance: score }, yahtzeeBonusCount: 0 };
}

function record(spec: Spec): GameRecord {
  const status = spec.status ?? 'finished';
  const created = createGame(
    spec.names.map((name, seat) => ({
      id: `${spec.id}-${seat}`,
      name,
      avatar: 'cupcake',
      colour: '#e8457c',
      type: 'human' as const,
    })),
  );
  if (!created.ok) throw new Error(created.error);
  const scorecards = spec.names.map((_, seat) => {
    const card = cardWith(spec.scores?.[seat] ?? 0, status === 'finished');
    if (spec.yahtzees?.seat !== seat) return card;
    return {
      boxes: { ...card.boxes, yahtzee: spec.yahtzees.box },
      yahtzeeBonusCount: spec.yahtzees.bonus,
    };
  });
  const state: GameState = {
    ...created.state,
    scorecards,
    status,
    round: status === 'finished' ? 13 : 4,
  };
  const startedAt = spec.startedAt ?? '2026-11-19T18:00:00.000Z';
  const savedAt = new Date(Date.parse(startedAt) + (spec.minutes ?? 20) * 60_000).toISOString();
  return {
    id: spec.id,
    state,
    startedAt,
    savedAt,
    endedAt: status === 'in_progress' ? null : savedAt,
    theme: null,
    turnRolls: [],
    turns: [],
  };
}

function storeWith(...specs: Spec[]): HistoryStore {
  const store = memoryHistory();
  specs.forEach((spec) => store.save(record(spec)));
  return store;
}

const ids = (store: HistoryStore, filter: Parameters<HistoryStore['listGames']>[0] = {}) =>
  store.listGames(filter).items.map((game) => game.id);

const playerId = (store: HistoryStore, name: string) =>
  store.listPlayers().find((p) => p.name === name)!.id;

describe('openDatabase', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('creates the folder and file, and keeps the data when opened again', () => {
    dir = mkdtempSync(join(tmpdir(), 'yahtzee-'));
    const path = join(dir, 'nested', 'history.db');
    const first = openDatabase(path);
    new HistoryStore(first).save(record({ id: 'g1', names: ['Emma', 'Sara'] }));
    first.close();

    const again = openDatabase(path);
    expect(again.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
    expect(ids(new HistoryStore(again))).toEqual(['g1']);
    again.close();
  });

  it('rolls back a transaction that fails', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE t (x INTEGER)');
    expect(() =>
      transaction(db, () => {
        db.exec('INSERT INTO t VALUES (1)');
        throw new Error('oops');
      }),
    ).toThrow('oops');
    expect(db.prepare('SELECT COUNT(*) AS n FROM t').get()).toEqual({ n: 0 });
  });
});

describe('time helpers', () => {
  it('finds the UTC start of an Amsterdam day, in winter and summer time', () => {
    expect(dayStartUtc('2026-11-19')).toBe('2026-11-18T23:00:00.000Z');
    expect(dayStartUtc('2026-07-01')).toBe('2026-06-30T22:00:00.000Z');
    expect(dayStartUtc('2026-12-31', 1)).toBe('2026-12-31T23:00:00.000Z');
  });

  it('gives the Amsterdam month of a UTC time', () => {
    expect(amsterdamMonth('2026-10-31T23:30:00.000Z')).toBe('2026-11');
    expect(amsterdamMonth('2026-10-31T22:30:00.000Z')).toBe('2026-10');
  });
});

describe('HistoryStore.save', () => {
  it('can save the same game again without duplicates', () => {
    const store = memoryHistory();
    const game = record({ id: 'g1', names: ['Emma', 'Sara'], scores: [10, 20] });
    store.save(game);
    store.save({ ...game, turns: [] });
    expect(store.listGames().total).toBe(1);
    expect(store.getGame('g1')!.players.map((p) => p.finalScore)).toEqual([10, 20]);
  });

  it('keeps the newest look of a returning player', () => {
    const store = memoryHistory();
    const first = record({ id: 'g1', names: ['Emma', 'Sara'] });
    store.save(first);
    const later = record({ id: 'g2', names: ['EMMA', 'Noor'], startedAt: '2026-11-20T10:00:00Z' });
    store.save({
      ...later,
      state: {
        ...later.state,
        players: later.state.players.map((p, i) => (i === 0 ? { ...p, avatar: 'donut' } : p)),
      },
    });
    const emma = store.listPlayers().find((p) => p.name === 'EMMA')!;
    expect(emma.avatar).toBe('donut');
    expect(store.listPlayers()).toHaveLength(3);
  });

  it('stores who won, several on a tie, nobody in an aborted game', () => {
    const store = storeWith(
      { id: 'win', names: ['Emma', 'Sara'], scores: [200, 150] },
      { id: 'tie', names: ['Emma', 'Sara'], scores: [180, 180] },
      { id: 'stop', names: ['Emma', 'Sara'], scores: [50, 10], status: 'aborted' },
    );
    const winnersOf = (id: string) =>
      store
        .getGame(id)!
        .players.filter((p) => p.isWinner)
        .map((p) => p.name);
    expect(winnersOf('win')).toEqual(['Emma']);
    expect(winnersOf('tie')).toEqual(['Emma', 'Sara']);
    expect(winnersOf('stop')).toEqual([]);
  });
});

describe('HistoryStore.findUnfinished', () => {
  it('returns the newest unfinished game and aborts older or unreadable ones', () => {
    const db = openDatabase(':memory:');
    const store = new HistoryStore(db);
    store.save(record({ id: 'old', names: ['A', 'B'], status: 'in_progress', minutes: 5 }));
    store.save(record({ id: 'new', names: ['C', 'D'], status: 'in_progress', minutes: 10 }));
    store.save(record({ id: 'bad', names: ['E', 'F'], status: 'in_progress', minutes: 15 }));
    db.prepare(`UPDATE games SET state_json = '{not json' WHERE id = 'bad'`).run();

    const found = store.findUnfinished();
    expect(found).toMatchObject({
      id: 'new',
      startedAt: '2026-11-19T18:00:00.000Z',
      savedAt: '2026-11-19T18:10:00.000Z',
      turnRolls: [],
    });
    expect(found!.state.players.map((p) => p.name)).toEqual(['C', 'D']);
    expect(store.getGame('old')).toMatchObject({
      status: 'aborted',
      endedAt: '2026-11-19T18:05:00.000Z',
    });
    expect(store.getGame('bad')!.status).toBe('aborted');
    expect(store.findUnfinished()!.id).toBe('new');
  });

  it('skips a snapshot from another version', () => {
    const db = openDatabase(':memory:');
    const store = new HistoryStore(db);
    store.save(record({ id: 'g1', names: ['A', 'B'], status: 'in_progress' }));
    db.prepare(`UPDATE games SET state_json = '{"v":2}'`).run();
    expect(store.findUnfinished()).toBeNull();
    expect(store.findUnfinished()).toBeNull();
  });
});

describe('HistoryStore.listGames', () => {
  const games: Spec[] = [
    {
      id: 'a',
      names: ['Emma', 'Sara'],
      scores: [200, 150],
      startedAt: '2026-11-18T22:59:00.000Z', // 18-11 23:59 in Amsterdam
      minutes: 30,
    },
    {
      id: 'b',
      names: ['Emma', 'Noor', 'Papa'],
      scores: [120, 250, 90],
      startedAt: '2026-11-18T23:30:00.000Z', // 19-11 00:30 in Amsterdam
      minutes: 10,
    },
    {
      id: 'c',
      names: ['Sara', 'Papa'],
      scores: [40, 60],
      status: 'aborted',
      startedAt: '2026-11-20T15:00:00.000Z',
      minutes: 5,
    },
    {
      id: 'd',
      names: ['Emma', 'Papa', 'Sara', 'Noor'],
      scores: [300, 300, 10, 20],
      startedAt: '2026-11-21T09:00:00.000Z',
      minutes: 45,
    },
    {
      id: 'e',
      names: ['Noor', 'Lieke'],
      scores: [15, 25],
      status: 'in_progress',
      startedAt: '2026-11-22T09:00:00.000Z',
    },
  ];

  it('lists all games newest first, with players in playing order', () => {
    const store = storeWith(...games);
    const list = store.listGames();
    expect(list).toMatchObject({ total: 5, page: 1, pageSize: 25 });
    expect(list.items.map((g) => g.id)).toEqual(['e', 'd', 'c', 'b', 'a']);
    const b = list.items.find((g) => g.id === 'b')!;
    expect(b).toMatchObject({ topScore: 250, durationSeconds: 600, status: 'finished' });
    expect(b.players.map((p) => [p.name, p.seatOrder, p.finalScore, p.isWinner])).toEqual([
      ['Emma', 0, 120, false],
      ['Noor', 1, 250, true],
      ['Papa', 2, 90, false],
    ]);
  });

  it('filters on Amsterdam days', () => {
    const store = storeWith(...games);
    expect(ids(store, { from: '2026-11-19', to: '2026-11-19' })).toEqual(['b']);
    expect(ids(store, { to: '2026-11-18' })).toEqual(['a']);
    expect(ids(store, { from: '2026-11-21' })).toEqual(['e', 'd']);
  });

  it('filters on players (all of them took part) and on the winner', () => {
    const store = storeWith(...games);
    const emma = playerId(store, 'Emma');
    const papa = playerId(store, 'Papa');
    expect(ids(store, { players: [emma] })).toEqual(['d', 'b', 'a']);
    expect(ids(store, { players: [emma, papa] })).toEqual(['d', 'b']);
    expect(ids(store, { winner: emma })).toEqual(['d', 'a']);
    expect(ids(store, { winner: papa })).toEqual(['d']);
  });

  it('filters on status, number of players and the highest score', () => {
    const store = storeWith(...games);
    expect(ids(store, { status: 'aborted' })).toEqual(['c']);
    expect(ids(store, { status: 'in_progress' })).toEqual(['e']);
    expect(ids(store, { playerCount: 2 })).toEqual(['e', 'c', 'a']);
    expect(ids(store, { minScore: 200 })).toEqual(['d', 'b', 'a']);
    expect(ids(store, { maxScore: 60 })).toEqual(['e', 'c']);
    expect(ids(store, { minScore: 100, maxScore: 250, status: 'finished' })).toEqual(['b', 'a']);
  });

  it('sorts on every column', () => {
    const store = storeWith(...games);
    expect(ids(store, { sort: 'date', order: 'asc' })).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(ids(store, { sort: 'duration' })).toEqual(['d', 'a', 'b', 'c', 'e']);
    expect(ids(store, { sort: 'duration', order: 'asc' })).toEqual(['c', 'b', 'a', 'd', 'e']);
    expect(ids(store, { sort: 'players' })).toEqual(['d', 'b', 'e', 'c', 'a']);
    expect(ids(store, { sort: 'score' })).toEqual(['d', 'b', 'a', 'c', 'e']);
    expect(ids(store, { sort: 'winner', order: 'asc' })).toEqual(['d', 'a', 'b', 'e', 'c']);
    expect(ids(store, { sort: 'status', order: 'asc' })).toEqual(['c', 'd', 'b', 'a', 'e']);
  });

  it('pages through the games', () => {
    const store = storeWith(...games);
    const page2 = store.listGames({ page: 2, pageSize: 2 });
    expect(page2).toMatchObject({ total: 5, page: 2, pageSize: 2 });
    expect(page2.items.map((g) => g.id)).toEqual(['c', 'b']);
    expect(ids(store, { page: 4, pageSize: 2 })).toEqual([]);
  });
});

describe('HistoryStore game detail and delete', () => {
  it('shows every scorecard, with empty boxes in an aborted game', () => {
    const store = storeWith({
      id: 'g1',
      names: ['Emma', 'Sara'],
      scores: [20, 15],
      status: 'aborted',
      minutes: 12,
    });
    const game = store.getGame('g1')!;
    expect(game).toMatchObject({
      status: 'aborted',
      roundsPlayed: 4,
      durationSeconds: 720,
      theme: null,
      startedAt: '2026-11-19T18:00:00.000Z',
      endedAt: '2026-11-19T18:12:00.000Z',
    });
    expect(game.players[0]).toMatchObject({
      name: 'Emma',
      upperTotal: 0,
      upperBonus: 0,
      lowerTotal: 20,
      yahtzeeBonusCount: 0,
      finalScore: 20,
    });
    expect(game.players[0]!.scorecard).toMatchObject({ chance: 20, ones: null });
    expect(store.getGame('nope')).toBeNull();
  });

  it('deletes finished and aborted games, never one in progress', () => {
    const store = storeWith(
      { id: 'done', names: ['Emma', 'Sara'] },
      { id: 'busy', names: ['Emma', 'Sara'], status: 'in_progress' },
    );
    expect(store.deleteGame('busy')).toBe('in_progress');
    expect(store.deleteGame('nope')).toBe('not_found');
    expect(store.deleteGame('done')).toBe('deleted');
    expect(ids(store)).toEqual(['busy']);
  });
});

describe('HistoryStore players and statistics', () => {
  it('lists players by name and recent players by last game', () => {
    const store = storeWith(
      { id: 'g1', names: ['Sara', 'Emma'], startedAt: '2026-11-01T10:00:00Z' },
      { id: 'g2', names: ['Noor', 'Emma'], startedAt: '2026-11-10T10:00:00Z' },
      { id: 'g3', names: ['emma', 'Lieke'], startedAt: '2026-11-15T10:00:00Z' },
    );
    expect(store.listPlayers().map((p) => p.name)).toEqual(['emma', 'Lieke', 'Noor', 'Sara']);
    expect(store.recentPlayers(3).map((p) => p.name)).toEqual(['emma', 'Lieke', 'Noor']);
  });

  it('never moves a player back in the recent list when an old game is saved again', () => {
    const store = memoryHistory();
    const old = record({ id: 'g1', names: ['Sara', 'Emma'], startedAt: '2026-11-01T10:00:00Z' });
    store.save(old);
    store.save(record({ id: 'g2', names: ['Emma', 'Noor'], startedAt: '2026-11-10T10:00:00Z' }));
    store.save(old);
    expect(store.recentPlayers(1).map((p) => p.name)).toEqual(['Emma']);
  });

  it('counts games, wins, scores and Yahtzees per player', () => {
    const store = storeWith(
      {
        id: 'g1',
        names: ['Emma', 'Sara'],
        scores: [200, 150],
        yahtzees: { seat: 0, box: 50, bonus: 2 },
      },
      { id: 'g2', names: ['Emma', 'Sara'], scores: [100, 151] },
      { id: 'g3', names: ['Emma', 'Sara'], scores: [301, 40] },
      {
        id: 'g4',
        names: ['Emma', 'Noor'],
        scores: [10, 20],
        status: 'aborted',
        yahtzees: { seat: 1, box: 50, bonus: 0 },
      },
    );
    const [emma, sara, noor] = store.playerStats();
    expect(emma).toMatchObject({
      name: 'Emma',
      gamesPlayed: 3,
      gamesWon: 2,
      winPercentage: 67,
      highestScore: 450,
      averageScore: 284,
      gamesAborted: 1,
      yahtzees: 3,
    });
    expect(sara).toMatchObject({ name: 'Sara', gamesWon: 1, winPercentage: 33, yahtzees: 0 });
    expect(noor).toMatchObject({
      name: 'Noor',
      gamesPlayed: 0,
      winPercentage: 0,
      highestScore: null,
      averageScore: null,
      gamesAborted: 1,
      yahtzees: 1,
    });
  });

  it('keeps a Hall of Fame of finished games', () => {
    const store = storeWith(
      { id: 'g1', names: ['Emma', 'Sara'], scores: [200, 150] },
      { id: 'g2', names: ['Noor', 'Sara'], scores: [250, 200], startedAt: '2026-11-20T10:00:00Z' },
      { id: 'g3', names: ['Papa', 'Sara'], scores: [999, 0], status: 'aborted' },
    );
    expect(store.hallOfFame(3).map((e) => [e.name, e.score, e.gameId])).toEqual([
      ['Noor', 250, 'g2'],
      ['Emma', 200, 'g1'],
      ['Sara', 200, 'g2'],
    ]);
    expect(store.hallOfFame()).toHaveLength(4);
  });

  it('counts games per Amsterdam month', () => {
    const store = storeWith(
      { id: 'g1', names: ['A', 'B'], startedAt: '2026-10-31T23:30:00.000Z' },
      { id: 'g2', names: ['A', 'B'], startedAt: '2026-11-15T10:00:00.000Z' },
      { id: 'g3', names: ['A', 'B'], startedAt: '2026-09-01T10:00:00.000Z' },
    );
    expect(store.gamesPerMonth()).toEqual([
      { month: '2026-09', games: 1 },
      { month: '2026-11', games: 2 },
    ]);
  });
});
