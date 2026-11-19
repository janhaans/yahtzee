import { describe, expect, it } from 'vitest';
import { ROUNDS, allowedBoxes, type DieValue, type Rng } from '@yahtzee/game-logic';
import { GameRoom } from '../src/room.js';

/** Rng that always rolls the same face. */
function always(face: DieValue): Rng {
  return () => (face - 1) / 6 + 0.01;
}

function newRoom(rng: Rng = Math.random): GameRoom {
  let id = 0;
  return new GameRoom(rng, () => `p${++id}`);
}

function started(rng?: Rng, names = ['Emma', 'Sara']): GameRoom {
  const room = newRoom(rng);
  expect(room.create(names)).toEqual({ ok: true });
  return room;
}

/** Plays one turn: roll once and take the first allowed box. */
function playTurn(room: GameRoom): void {
  expect(room.roll()).toEqual({ ok: true });
  const state = room.state!;
  const box = allowedBoxes(state.dice!, state.scorecards[state.currentPlayerIndex]!)[0];
  expect(room.chooseBox(box)).toEqual({ ok: true });
}

describe('GameRoom', () => {
  it('starts without a game', () => {
    const room = newRoom();
    expect(room.state).toBeNull();
    expect(room.roll()).toEqual({ ok: false, error: 'no_game' });
    expect(room.abort()).toEqual({ ok: false, error: 'no_game' });
    expect(room.rematch()).toEqual({ ok: false, error: 'no_game' });
  });

  it('creates human players with ids, avatar and colour', () => {
    const room = started(undefined, ['Emma', 'Sara', 'Noor', 'Lieke']);
    const players = room.state!.players;
    expect(players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(players.every((p) => p.type === 'human')).toBe(true);
    expect(new Set(players.map((p) => p.avatar)).size).toBe(4);
    expect(new Set(players.map((p) => p.colour)).size).toBe(4);
  });

  it('only allows 2 to 4 players', () => {
    expect(newRoom().create(['Emma'])).toEqual({ ok: false, error: 'too_few_players' });
    expect(newRoom().create(['A', 'B', 'C', 'D', 'E'])).toEqual({
      ok: false,
      error: 'too_many_players',
    });
  });

  it('rejects duplicate names, ignoring case and extra spaces', () => {
    expect(newRoom().create(['Anna Sophie', ' anna   SOPHIE '])).toEqual({
      ok: false,
      error: 'duplicate_name',
    });
  });

  it('rejects malformed create payloads', () => {
    const room = newRoom();
    expect(room.create(undefined)).toEqual({ ok: false, error: 'invalid_input' });
    expect(room.create('Emma')).toEqual({ ok: false, error: 'invalid_input' });
    expect(room.create(['Emma', 42])).toEqual({ ok: false, error: 'invalid_input' });
    expect(room.create(Array.from({ length: 11 }, (_, i) => `P${i}`))).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(room.state).toBeNull();
  });

  it('does not start a new game while one is in progress', () => {
    const room = started();
    expect(room.create(['Noor', 'Lieke'])).toEqual({ ok: false, error: 'game_in_progress' });
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
    expect(room.create(['Noor', 'Lieke'])).toEqual({ ok: true });
  });
});
