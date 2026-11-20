import { describe, expect, it } from 'vitest';
import { allowedBoxes } from '@yahtzee/game-logic';
import { Presence } from '../src/presence.js';
import { TAKE_OVER_AFTER_MS } from '../src/protocol.js';
import { TABLE, type Actor, type GameRoom } from '../src/room.js';
import { always, lineup, memoryHistory, newRoom } from './helpers.js';

/** A clock that only moves when the test says so. */
function clock(start = '2026-11-20T18:00:00.000Z') {
  let time = Date.parse(start);
  return {
    now: () => new Date(time),
    wait: (ms: number) => {
      time += ms;
    },
  };
}

const phone = (token: string | null): Actor => ({ kind: 'phone', token });

/** Emma plays on the laptop, Sara on the phone with token "sara". */
function mixedGame() {
  const time = clock();
  const room = newRoom(memoryHistory(), always(6), time.now);
  const result = room.create(lineup(['Emma', 'Sara']), [
    { id: 'emma', token: null },
    { id: 'sara', token: 'sara' },
  ]);
  expect(result).toEqual({ ok: true });
  room.presence.connect('sara');
  return { room, time };
}

/** Plays the current turn as this actor: roll once and take the first allowed box. */
function play(room: GameRoom, actor: Actor = TABLE) {
  expect(room.roll(actor)).toEqual({ ok: true });
  const state = room.state!;
  const box = allowedBoxes(state.dice!, state.scorecards[state.currentPlayerIndex]!)[0]!;
  expect(room.chooseBox(box, actor)).toEqual({ ok: true });
}

describe('Presence', () => {
  it('is online while at least one tab of a phone is connected', () => {
    const time = clock();
    const presence = new Presence(time.now);
    expect(presence.isOnline('a')).toBe(false);
    expect(presence.offlineSince('a')).toBe(new Date(0).toISOString());

    presence.connect('a');
    presence.connect('a');
    presence.disconnect('a');
    expect(presence.offlineSince('a')).toBeNull();
    time.wait(1000);
    presence.disconnect('a');
    expect(presence.offlineSince('a')).toBe('2026-11-20T18:00:01.000Z');
    presence.connect('a');
    expect(presence.isOnline('a')).toBe(true);
  });

  it('uses the real clock by default', () => {
    const presence = new Presence();
    presence.disconnect('a');
    expect(Date.parse(presence.offlineSince('a')!)).toBeGreaterThan(0);
  });
});

describe('GameRoom seats', () => {
  it('uses the ids and tokens of the seats and tells where everyone plays', () => {
    const { room } = mixedGame();
    expect(room.state!.players.map((p) => p.id)).toEqual(['emma', 'sara']);
    expect(room.playerFor('sara')).toBe('sara');
    expect(room.playerFor('nobody')).toBeNull();
    expect(room.playerFor(null)).toBeNull();
    expect(room.seats).toEqual([
      { playerId: 'emma', controller: 'table', online: true, offlineSince: null, takenOver: false },
      { playerId: 'sara', controller: 'phone', online: true, offlineSince: null, takenOver: false },
    ]);
  });

  it('has no seats without a game, and laptop seats by default', () => {
    const room = newRoom();
    expect(room.seats).toEqual([]);
    room.create(lineup(['Emma', 'Sara']));
    expect(room.seats.map((s) => s.controller)).toEqual(['table', 'table']);
  });

  it('only lets a phone play its own turn, and the laptop only laptop turns', () => {
    const { room } = mixedGame();
    expect(room.roll(phone('sara'))).toEqual({ ok: false, error: 'not_your_turn' });
    expect(room.roll(phone(null))).toEqual({ ok: false, error: 'not_your_turn' });
    play(room, TABLE);

    // Sara's turn: the laptop and other phones cannot touch it.
    expect(room.roll(TABLE)).toEqual({ ok: false, error: 'not_your_turn' });
    expect(room.roll(phone('emma'))).toEqual({ ok: false, error: 'not_your_turn' });
    expect(room.roll(phone('sara'))).toEqual({ ok: true });
    expect(room.toggleHold(0, TABLE)).toEqual({ ok: false, error: 'not_your_turn' });
    expect(room.chooseBox('sixes', TABLE)).toEqual({ ok: false, error: 'not_your_turn' });
    expect(room.toggleHold(0, phone('sara'))).toEqual({ ok: true });
    expect(room.chooseBox('sixes', phone('sara'))).toEqual({ ok: true });
    expect(room.state!.currentPlayerIndex).toBe(0);
  });

  it('lets the laptop stop the game on a phone turn', () => {
    const { room } = mixedGame();
    play(room);
    expect(room.abort()).toEqual({ ok: true });
    expect(room.state!.status).toBe('aborted');
  });

  it('lets the laptop take over a turn only after the phone was gone for a while', () => {
    const { room, time } = mixedGame();
    expect(room.takeOver()).toEqual({ ok: false, error: 'not_allowed' });
    play(room);
    expect(room.takeOver()).toEqual({ ok: false, error: 'too_early' });

    room.presence.disconnect('sara');
    expect(room.seats[1]).toMatchObject({
      online: false,
      offlineSince: '2026-11-20T18:00:00.000Z',
    });
    time.wait(TAKE_OVER_AFTER_MS - 1);
    expect(room.takeOver()).toEqual({ ok: false, error: 'too_early' });
    time.wait(1);
    expect(room.takeOver()).toEqual({ ok: true });
    expect(room.seats[1]!.takenOver).toBe(true);

    // The laptop plays this one turn; the next turn of Sara is hers again.
    play(room, TABLE);
    expect(room.seats[1]!.takenOver).toBe(false);
    play(room, TABLE);
    expect(room.roll(TABLE)).toEqual({ ok: false, error: 'not_your_turn' });
  });

  it('does not take over without a running game', () => {
    expect(newRoom().takeOver()).toEqual({ ok: false, error: 'no_game' });
  });

  it('lets a phone claim a laptop player or an offline phone player', () => {
    const { room } = mixedGame();
    expect(room.claim('sara')).toEqual({ ok: false, error: 'seat_taken' });
    expect(room.claim('nobody')).toEqual({ ok: false, error: 'invalid_input' });

    // Emma moves from the laptop to a phone.
    const emma = room.claim('emma');
    expect(emma).toMatchObject({ ok: true, playerId: 'emma' });
    const emmaToken = (emma as { token: string }).token;
    expect(room.playerFor(emmaToken)).toBe('emma');
    expect(room.roll(TABLE)).toEqual({ ok: false, error: 'not_your_turn' });
    expect(room.roll(phone(emmaToken))).toEqual({ ok: true });

    // Sara's phone is gone; a new phone takes her place and the old token stops working.
    room.presence.disconnect('sara');
    const sara = room.claim('sara');
    expect(sara).toMatchObject({ ok: true, playerId: 'sara' });
    expect(room.playerFor('sara')).toBeNull();
    expect(room.playerFor((sara as { token: string }).token)).toBe('sara');
  });

  it('only allows claiming in a running game', () => {
    expect(newRoom().claim('emma')).toEqual({ ok: false, error: 'no_game' });
  });

  it('keeps the phones in a rematch', () => {
    const time = clock();
    const room = newRoom(memoryHistory(), always(6), time.now);
    room.create(lineup(['Emma', 'Sara']), [
      { id: 'emma', token: null },
      { id: 'sara', token: 'sara' },
    ]);
    room.presence.connect('sara');
    for (let turn = 0; turn < 26; turn++) play(room, turn % 2 === 0 ? TABLE : phone('sara'));
    expect(room.state!.status).toBe('finished');
    expect(room.rematch()).toEqual({ ok: true });
    expect(room.seats.map((s) => s.controller)).toEqual(['table', 'phone']);
    expect(room.playerFor('sara')).toBe('sara');
  });

  it('puts everyone on the laptop when an unfinished game continues', () => {
    const history = memoryHistory();
    const first = newRoom(history, always(6));
    first.create(lineup(['Emma', 'Sara']), [
      { id: 'emma', token: null },
      { id: 'sara', token: 'sara' },
    ]);
    first.roll();
    const second = newRoom(history);
    expect(second.resume()).toEqual({ ok: true });
    expect(second.seats.map((s) => s.controller)).toEqual(['table', 'table']);
    expect(second.playerFor('sara')).toBeNull();
    expect(second.claim('sara')).toMatchObject({ ok: true });
  });
});
