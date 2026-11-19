import { describe, expect, it, vi } from 'vitest';
import { ROUNDS, type Rng } from '@yahtzee/game-logic';
import { openDatabase } from '../src/history/db.js';
import { HistoryStore } from '../src/history/store.js';
import { GameRoom } from '../src/room.js';
import {
  FlakyHistory,
  always,
  lineup,
  memoryHistory,
  newRoom as roomWith,
  playTurn,
  ticking,
} from './helpers.js';

function newRoom(rng: Rng = Math.random): GameRoom {
  return roomWith(memoryHistory(), rng);
}

function started(rng?: Rng, names = ['Emma', 'Sara']): GameRoom {
  const room = newRoom(rng);
  expect(room.create(lineup(names))).toEqual({ ok: true });
  return room;
}

describe('GameRoom', () => {
  it('starts without a game', () => {
    const room = newRoom();
    expect(room.state).toBeNull();
    expect(room.roll()).toEqual({ ok: false, error: 'no_game' });
    expect(room.abort()).toEqual({ ok: false, error: 'no_game' });
    expect(room.rematch()).toEqual({ ok: false, error: 'no_game' });
  });

  it('creates human players with ids and the chosen avatar and colour', () => {
    const room = newRoom();
    const setup = lineup(['Emma', 'Sara', 'Noor', 'Lieke'], 'snoep');
    expect(room.create(setup)).toEqual({ ok: true });
    const players = room.state!.players;
    expect(new Set(players.map((p) => p.id)).size).toBe(4);
    expect(players.every((p) => p.type === 'human')).toBe(true);
    expect(players.map(({ name, avatar, colour }) => ({ name, avatar, colour }))).toEqual(
      setup.players,
    );
    expect(room.theme).toBe('snoep');
  });

  it('lets players share an avatar but not a colour', () => {
    const setup = lineup(['Emma', 'Sara']);
    const sameAvatar = setup.players.map((p) => ({ ...p, avatar: 'unicorn' }));
    expect(newRoom().create({ ...setup, players: sameAvatar })).toEqual({ ok: true });
    const sameColour = setup.players.map((p) => ({ ...p, colour: '#e8457c' }));
    expect(newRoom().create({ ...setup, players: sameColour })).toEqual({
      ok: false,
      error: 'duplicate_colour',
    });
  });

  it('only allows 2 to 4 players', () => {
    expect(newRoom().create(lineup(['Emma']))).toEqual({ ok: false, error: 'too_few_players' });
    expect(newRoom().create(lineup(['A', 'B', 'C', 'D', 'E']))).toEqual({
      ok: false,
      error: 'too_many_players',
    });
  });

  it('rejects duplicate names, ignoring case and extra spaces', () => {
    expect(newRoom().create(lineup(['Anna Sophie', ' anna   SOPHIE ']))).toEqual({
      ok: false,
      error: 'duplicate_name',
    });
  });

  it('rejects malformed create payloads', () => {
    const room = newRoom();
    const setup = lineup(['Emma', 'Sara']);
    const [emma, sara] = setup.players;
    const bad: unknown[] = [
      undefined,
      'Emma',
      ['Emma', 'Sara'],
      { players: setup.players },
      { ...setup, theme: 'ruimte' },
      { ...setup, players: 'Emma' },
      { ...setup, players: [emma, null] },
      { ...setup, players: [emma, { ...sara, name: 42 }] },
      { ...setup, players: [emma, { ...sara, avatar: 'dragon' }] },
      { ...setup, players: [emma, { ...sara, colour: 'red' }] },
      lineup(Array.from({ length: 11 }, (_, i) => `P${i}`)),
    ];
    for (const payload of bad) {
      expect(room.create(payload)).toEqual({ ok: false, error: 'invalid_input' });
    }
    expect(room.state).toBeNull();
    expect(room.theme).toBeNull();
  });

  it('does not start a new game while one is in progress', () => {
    const room = started();
    expect(room.create(lineup(['Noor', 'Lieke']))).toEqual({
      ok: false,
      error: 'game_in_progress',
    });
    expect(room.state!.players[0]!.name).toBe('Emma');
  });

  it('rolls, holds and scores', () => {
    const room = started(always(3));
    expect(room.chooseBox('threes')).toEqual({ ok: false, error: 'not_rolled_yet' });
    expect(room.roll()).toEqual({ ok: true });
    expect(room.state!.dice).toEqual([3, 3, 3, 3, 3]);
    expect(room.toggleHold(2)).toEqual({ ok: true });
    expect(room.state!.held).toEqual([false, false, true, false, false]);
    expect(room.chooseBox('chance')).toEqual({ ok: true });
    expect(room.state!.scorecards[0]!.boxes.chance).toBe(15);
    expect(room.state!.currentPlayerIndex).toBe(1);
  });

  it('allows at most 3 rolls per turn', () => {
    const room = started();
    room.roll();
    room.roll();
    room.roll();
    expect(room.roll()).toEqual({ ok: false, error: 'no_rolls_left' });
  });

  it('rejects malformed hold and box payloads', () => {
    const room = started();
    room.roll();
    expect(room.toggleHold('1')).toEqual({ ok: false, error: 'invalid_input' });
    expect(room.toggleHold(7)).toEqual({ ok: false, error: 'invalid_die_index' });
    expect(room.toggleHold(1.5)).toEqual({ ok: false, error: 'invalid_die_index' });
    expect(room.chooseBox('bonus')).toEqual({ ok: false, error: 'invalid_input' });
    expect(room.chooseBox(undefined)).toEqual({ ok: false, error: 'invalid_input' });
    expect(room.chooseBox({ box: 'chance' })).toEqual({ ok: false, error: 'invalid_input' });
  });

  it('rejects a box that is already filled', () => {
    const room = started(always(2));
    room.roll();
    expect(room.chooseBox('twos')).toEqual({ ok: true }); // Emma
    playTurn(room); // Sara
    room.roll();
    expect(room.chooseBox('twos')).toEqual({ ok: false, error: 'box_not_allowed' });
  });

  it('enforces the Joker rule on the server', () => {
    const room = started(always(6));
    room.roll();
    expect(room.chooseBox('yahtzee')).toEqual({ ok: true }); // Emma: 50
    playTurn(room); // Sara

    // Emma rolls a second Yahtzee of sixes: the empty Sixes box must be filled.
    room.roll();
    expect(room.chooseBox('fullHouse')).toEqual({ ok: false, error: 'box_not_allowed' });
    expect(room.chooseBox('chance')).toEqual({ ok: false, error: 'box_not_allowed' });
    expect(room.chooseBox('sixes')).toEqual({ ok: true });
    expect(room.state!.scorecards[0]!.boxes.sixes).toBe(30);
    expect(room.state!.scorecards[0]!.yahtzeeBonusCount).toBe(1);
  });

  it('plays a full game and allows a rematch with the same players', () => {
    const room = started();
    expect(room.rematch()).toEqual({ ok: false, error: 'game_not_finished' });
    for (let turn = 0; turn < ROUNDS * 2; turn++) playTurn(room);

    expect(room.state!.status).toBe('finished');
    expect(room.roll()).toEqual({ ok: false, error: 'game_over' });

    const players = room.state!.players;
    expect(room.rematch()).toEqual({ ok: true });
    expect(room.state!.players).toEqual(players);
    expect(room.theme).toBe('voetbal');
    expect(room.state!.round).toBe(1);
    expect(room.state!.status).toBe('in_progress');
  });

  it('aborts a game and then allows a new one', () => {
    const room = started();
    playTurn(room);
    expect(room.abort()).toEqual({ ok: true });
    expect(room.state!.status).toBe('aborted');
    expect(room.abort()).toEqual({ ok: false, error: 'game_over' });
    expect(room.rematch()).toEqual({ ok: false, error: 'game_not_finished' });
    expect(room.create(lineup(['Noor', 'Lieke']))).toEqual({ ok: true });
  });
});

describe('GameRoom history', () => {
  function setup() {
    const db = openDatabase(':memory:');
    const history = new HistoryStore(db);
    const room = roomWith(history, always(3));
    return { db, history, room };
  }

  it('saves nothing until the first roll', () => {
    const { history, room } = setup();
    room.create(lineup(['Emma', 'Sara']));
    expect(history.listGames().total).toBe(0);
    room.abort();
    expect(history.listGames().total).toBe(0);
    expect(history.listPlayers()).toEqual([]);
  });

  it('creates the game at the first roll and saves every roll and hold', () => {
    const { history, room } = setup();
    room.create(lineup(['Emma', 'Sara']));
    room.roll();
    const [game] = history.listGames().items;
    expect(game).toMatchObject({
      startedAt: '2026-11-19T18:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      status: 'in_progress',
      roundsPlayed: 1,
      theme: 'voetbal',
    });
    expect(game!.players.map((p) => p.name)).toEqual(['Emma', 'Sara']);

    room.toggleHold(1);
    expect(history.findUnfinished()?.state.held).toEqual([false, true, false, false, false]);
  });

  it('saves the scorecards and the turn after every box', () => {
    const { db, history, room } = setup();
    room.create(lineup(['Emma', 'Sara']));
    room.roll();
    room.roll();
    room.chooseBox('threes');
    const detail = history.getGame(history.listGames().items[0]!.id)!;
    expect(detail.players[0]).toMatchObject({ upperTotal: 15, finalScore: 15 });
    expect(detail.players[0]!.scorecard.threes).toBe(15);
    expect(detail.players[1]!.scorecard.threes).toBeNull();

    const turns = db.prepare('SELECT round, seat_order, rolls, box, points FROM turns').all();
    expect(turns).toEqual([
      {
        round: 1,
        seat_order: 0,
        rolls: JSON.stringify([
          [3, 3, 3, 3, 3],
          [3, 3, 3, 3, 3],
        ]),
        box: 'threes',
        points: 15,
      },
    ]);
  });

  it('saves a finished game with all tied players as winners', () => {
    const { history, room } = setup();
    room.create(lineup(['Emma', 'Sara']));
    for (let turn = 0; turn < ROUNDS * 2; turn++) playTurn(room);

    const [game] = history.listGames().items;
    expect(game!.status).toBe('finished');
    expect(game!.roundsPlayed).toBe(13);
    expect(game!.endedAt).not.toBeNull();
    expect(game!.durationSeconds).toBe(ROUNDS * 2 * 2 * 60 - 60);
    expect(game!.players.every((p) => p.isWinner)).toBe(true);
    expect(history.findUnfinished()).toBeNull();
  });

  it('saves an aborted game without a winner, with the round reached', () => {
    const { history, room } = setup();
    room.create(lineup(['Emma', 'Sara']));
    playTurn(room);
    playTurn(room);
    playTurn(room);
    room.abort();
    const [game] = history.listGames().items;
    expect(game).toMatchObject({ status: 'aborted', roundsPlayed: 2 });
    expect(game!.endedAt).not.toBeNull();
    expect(game!.players.some((p) => p.isWinner)).toBe(false);
  });

  it('stores a rematch as a new game with the same players', () => {
    const { history, room } = setup();
    room.create(lineup(['Emma', 'Sara']));
    for (let turn = 0; turn < ROUNDS * 2; turn++) playTurn(room);
    room.rematch();
    room.roll();
    expect(history.listGames().total).toBe(2);
    expect(history.listPlayers()).toHaveLength(2);
  });

  it('recognises a returning player by name, ignoring case and extra spaces', () => {
    const { history, room } = setup();
    room.create(lineup(['Anna Sophie', 'Sara']));
    room.roll();
    room.abort();
    room.create(lineup(['  anna   SOPHIE ', 'Noor']));
    room.roll();

    const players = history.listPlayers();
    expect(players.map((p) => p.name)).toEqual(['anna SOPHIE', 'Noor', 'Sara']);
    const anna = players[0]!.id;
    expect(history.listGames({ players: [anna] }).total).toBe(2);
  });

  it('keeps playing when a save fails and saves everything after the next turn', () => {
    const flaky = new FlakyHistory();
    const log = vi.fn();
    const room = new GameRoom(always(2), { history: flaky, now: ticking(), log });
    room.create(lineup(['Emma', 'Sara']));

    flaky.failing = true;
    expect(room.roll()).toEqual({ ok: true });
    expect(room.chooseBox('twos')).toEqual({ ok: true });
    expect(room.saveFailed).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('trying again'), expect.any(Error));
    expect(flaky.inner.listGames().total).toBe(0);

    flaky.failing = false;
    playTurn(room);
    expect(room.saveFailed).toBe(false);
    const detail = flaky.inner.getGame(flaky.inner.listGames().items[0]!.id)!;
    expect(detail.players[0]!.scorecard.twos).toBe(10);
    expect(detail.players[1]!.scorecard.ones).toBe(0);
  });

  it('saves a game that ended during a failure when the next game starts', () => {
    const flaky = new FlakyHistory();
    const room = roomWith(flaky, always(4));
    room.create(lineup(['Emma', 'Sara']));
    playTurn(room);
    flaky.failing = true;
    room.abort();
    expect(room.saveFailed).toBe(true);
    expect(flaky.inner.listGames().items[0]!.status).toBe('in_progress');

    flaky.failing = false;
    room.create(lineup(['Noor', 'Lieke']));
    expect(room.saveFailed).toBe(true);
    room.roll();
    expect(room.saveFailed).toBe(false);
    const statuses = flaky.inner.listGames().items.map((g) => g.status);
    expect(statuses.sort()).toEqual(['aborted', 'in_progress']);
  });
});

describe('GameRoom unfinished game', () => {
  /** Plays a bit, then "restarts the server": a new room on the same history. */
  function restarted() {
    const history = memoryHistory();
    const before = roomWith(history, always(5));
    before.create(lineup(['Emma', 'Sara'], 'snoep'));
    playTurn(before);
    before.roll();
    before.toggleHold(0);
    const after = roomWith(history, always(5));
    return { history, before, after };
  }

  it('offers the unfinished game after a restart and blocks a new game', () => {
    const { after } = restarted();
    expect(after.state).toBeNull();
    expect(after.unfinished).toEqual({
      players: expect.arrayContaining([expect.objectContaining({ name: 'Emma' })]),
      round: 1,
      startedAt: '2026-11-19T18:00:00.000Z',
    });
    expect(after.create(lineup(['Noor', 'Lieke']))).toEqual({
      ok: false,
      error: 'unfinished_game',
    });
  });

  it('continues exactly where the game was, with the same dice', () => {
    const { history, before, after } = restarted();
    expect(after.resume()).toEqual({ ok: true });
    expect(after.unfinished).toBeNull();
    expect(after.state).toEqual(before.state);
    expect(after.theme).toBe('snoep');

    after.chooseBox('fives');
    expect(history.listGames().total).toBe(1);
    const game = history.getGame(history.listGames().items[0]!.id)!;
    expect(game.players[1]!.scorecard.fives).toBe(25);
    expect(after.resume()).toEqual({ ok: false, error: 'no_unfinished_game' });
  });

  it('stops the unfinished game: aborted, ending at its last save', () => {
    const { history, after } = restarted();
    expect(after.discardUnfinished()).toEqual({ ok: true });
    expect(after.unfinished).toBeNull();
    expect(after.state).toBeNull();
    const [game] = history.listGames().items;
    expect(game).toMatchObject({
      status: 'aborted',
      endedAt: '2026-11-19T18:03:00.000Z',
      theme: 'snoep',
    });
    expect(after.discardUnfinished()).toEqual({ ok: false, error: 'no_unfinished_game' });
    expect(after.create(lineup(['Noor', 'Lieke']))).toEqual({ ok: true });
  });

  it('keeps trying to save a stopped unfinished game', () => {
    const { history } = restarted();
    const flaky = new FlakyHistory(history);
    const room = roomWith(flaky);
    flaky.failing = true;
    room.discardUnfinished();
    expect(room.saveFailed).toBe(true);
    flaky.failing = false;
    room.create(lineup(['Noor', 'Lieke']));
    room.roll();
    expect(room.saveFailed).toBe(false);
    expect(history.listGames({ status: 'aborted' }).total).toBe(1);
  });

  it('continues an old game without a theme in the default theme', () => {
    const { history } = restarted();
    const saved = history.findUnfinished()!;
    const room = roomWith({ save: () => {}, findUnfinished: () => ({ ...saved, theme: null }) });
    expect(room.resume()).toEqual({ ok: true });
    expect(room.theme).toBe('voetbal');
  });

  it('starts normally when the history cannot be read', () => {
    const log = vi.fn();
    const room = new GameRoom(Math.random, {
      history: {
        save: () => {},
        findUnfinished: () => {
          throw new Error('broken file');
        },
      },
      log,
    });
    expect(room.unfinished).toBeNull();
    expect(room.create(lineup(['Emma', 'Sara']))).toEqual({ ok: true });
    expect(log).toHaveBeenCalled();
  });
});
