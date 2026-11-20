import { describe, expect, it } from 'vitest';
import { COLOURS } from '../src/looks.js';
import { Lobby } from '../src/lobby.js';
import { TABLE, type Actor } from '../src/room.js';
import { lineup, memoryHistory, newRoom, playTurn } from './helpers.js';

const phone = (token: string | null): Actor => ({ kind: 'phone', token });

let lastId = 0;

function openLobby(theme: 'voetbal' | 'snoep' = 'voetbal') {
  const room = newRoom(memoryHistory());
  const lobby = new Lobby(room, { newId: () => `l${++lastId}` });
  expect(lobby.open(TABLE, theme)).toEqual({ ok: true });
  return { room, lobby };
}

const players = (lobby: Lobby) => lobby.state!.players;

/** A phone joins; returns its token and player id. */
function join(lobby: Lobby, name: string, colour: string = COLOURS[5]) {
  const result = lobby.join(phone(null), { name, avatar: 'cat', colour });
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe('Lobby', () => {
  it('opens with two empty laptop players in the theme', () => {
    const { lobby } = openLobby('snoep');
    expect(lobby.state).toEqual({
      theme: 'snoep',
      players: [
        expect.objectContaining({ name: '', avatar: 'cupcake', controller: 'table', online: true }),
        expect.objectContaining({ name: '', avatar: 'lollipop', controller: 'table' }),
      ],
    });
    expect(new Set(players(lobby).map((p) => p.colour)).size).toBe(2);
  });

  it('is only opened and closed by the laptop, with a valid theme, when no game runs', () => {
    const room = newRoom();
    const lobby = new Lobby(room);
    expect(lobby.state).toBeNull();
    expect(lobby.open(phone('x'), 'voetbal')).toEqual({ ok: false, error: 'not_allowed' });
    expect(lobby.open(TABLE, 'disco')).toEqual({ ok: false, error: 'invalid_input' });
    room.create(lineup(['Emma', 'Sara']));
    expect(lobby.open(TABLE, 'voetbal')).toEqual({ ok: false, error: 'game_in_progress' });

    room.abort();
    expect(lobby.open(TABLE, 'voetbal')).toEqual({ ok: true });
    expect(lobby.close(phone('x'))).toEqual({ ok: false, error: 'not_allowed' });
    expect(lobby.close(TABLE)).toEqual({ ok: true });
    expect(lobby.state).toBeNull();
  });

  it('answers no_lobby while nobody sets up a game', () => {
    const lobby = new Lobby(newRoom());
    expect(lobby.add(TABLE)).toEqual({ ok: false, error: 'no_lobby' });
    expect(lobby.join(phone(null), {})).toEqual({ ok: false, error: 'no_lobby' });
    expect(lobby.start(TABLE)).toEqual({ ok: false, error: 'no_lobby' });
    expect(lobby.playerFor('x')).toBeNull();
  });

  it('lets the laptop add, change and remove laptop players, up to 4', () => {
    const { lobby } = openLobby();
    expect(lobby.add(phone('x'))).toEqual({ ok: false, error: 'not_allowed' });
    expect(lobby.add(TABLE)).toEqual({ ok: true });
    expect(lobby.add(TABLE)).toEqual({ ok: true });
    expect(lobby.add(TABLE)).toEqual({ ok: false, error: 'too_many_players' });

    const [first, second] = players(lobby);
    // Names may be empty or double while typing; the start checks them.
    expect(lobby.update(TABLE, first!.id, { name: 'Emma', avatar: 'fox' })).toEqual({ ok: true });
    expect(lobby.update(TABLE, second!.id, { name: 'Een heel erg lange naam' })).toEqual({
      ok: true,
    });
    expect(players(lobby)[1]!.name).toBe('Een heel erg la');
    expect(lobby.update(TABLE, second!.id, { colour: first!.colour })).toEqual({
      ok: false,
      error: 'duplicate_colour',
    });
    expect(lobby.update(TABLE, second!.id, { colour: COLOURS[7] })).toEqual({ ok: true });
    expect(players(lobby)[0]).toMatchObject({ name: 'Emma', avatar: 'fox' });

    expect(lobby.remove(TABLE, first!.id)).toEqual({ ok: true });
    expect(players(lobby)).toHaveLength(3);
    expect(lobby.remove(TABLE, 'nobody')).toEqual({ ok: false, error: 'invalid_input' });
  });

  it('refuses malformed changes', () => {
    const { lobby } = openLobby();
    const id = players(lobby)[0]!.id;
    for (const change of [null, 'x', { name: 5 }, { avatar: 'dragon' }, { colour: 'red' }]) {
      expect(lobby.update(TABLE, id, change), JSON.stringify(change)).toEqual({
        ok: false,
        error: 'invalid_input',
      });
    }
    expect(lobby.update(TABLE, 'nobody', {})).toEqual({ ok: false, error: 'invalid_input' });
  });

  it('keeps at least two rows when players leave', () => {
    const { lobby } = openLobby();
    const [first] = players(lobby);
    expect(lobby.remove(TABLE, first!.id)).toEqual({ ok: true });
    expect(players(lobby)).toHaveLength(2);
    expect(players(lobby)[0]!.id).not.toBe(first!.id);
  });

  it('lets a phone join in the place of the first empty laptop row', () => {
    const { lobby } = openLobby();
    const [first] = players(lobby);
    lobby.update(TABLE, first!.id, { name: 'Emma' });

    const sara = join(lobby, '  Sara  ');
    expect(players(lobby).map((p) => [p.name, p.controller])).toEqual([
      ['Emma', 'table'],
      ['Sara', 'phone'],
    ]);
    expect(lobby.playerFor(sara.token)).toBe(sara.playerId);
    expect(lobby.playerFor(null)).toBeNull();
    // Nobody connected with the token yet, so the phone shows as offline.
    expect(players(lobby)[1]!.online).toBe(false);

    // No empty rows left: the next phones come last, up to 4 players.
    join(lobby, 'Noor', COLOURS[6]);
    join(lobby, 'Lieke', COLOURS[7]);
    expect(players(lobby)).toHaveLength(4);
    expect(lobby.join(phone(null), { name: 'Fenna', avatar: 'cat', colour: COLOURS[4] })).toEqual({
      ok: false,
      error: 'too_many_players',
    });
  });

  it('checks the name and colour of a phone at once', () => {
    const { lobby } = openLobby();
    lobby.update(TABLE, players(lobby)[0]!.id, { name: 'Emma' });
    const tryJoin = (name: unknown, colour: string = COLOURS[5], avatar = 'cat') =>
      lobby.join(phone(null), { name, avatar, colour });

    expect(lobby.join(TABLE, {})).toEqual({ ok: false, error: 'not_allowed' });
    expect(lobby.join(phone(null), null)).toEqual({ ok: false, error: 'invalid_input' });
    expect(tryJoin(5)).toEqual({ ok: false, error: 'invalid_input' });
    expect(tryJoin('Sara', COLOURS[5], 'dragon')).toEqual({ ok: false, error: 'invalid_input' });
    expect(tryJoin('   ')).toEqual({ ok: false, error: 'name_required' });
    expect(tryJoin('Een heel erg lange naam')).toEqual({ ok: false, error: 'name_too_long' });
    expect(tryJoin(' EMMA ')).toEqual({ ok: false, error: 'duplicate_name' });
    expect(tryJoin('Sara', players(lobby)[0]!.colour)).toEqual({
      ok: false,
      error: 'duplicate_colour',
    });
  });

  it('lets a phone change and remove only its own player', () => {
    const { lobby } = openLobby();
    const sara = join(lobby, 'Sara');
    const noor = join(lobby, 'Noor', COLOURS[6]);
    const me = phone(sara.token);

    expect(lobby.update(me, sara.playerId, { avatar: 'panda', name: 'Saar' })).toEqual({
      ok: true,
    });
    expect(lobby.update(me, sara.playerId, { name: 'noor' })).toEqual({
      ok: false,
      error: 'duplicate_name',
    });
    expect(lobby.update(me, noor.playerId, { avatar: 'panda' })).toEqual({
      ok: false,
      error: 'not_allowed',
    });
    // The laptop does not change phone players either; it can only send them away.
    expect(lobby.update(TABLE, sara.playerId, { name: 'X' })).toEqual({
      ok: false,
      error: 'not_allowed',
    });
    expect(lobby.remove(me, noor.playerId)).toEqual({ ok: false, error: 'not_allowed' });
    expect(lobby.reorder(me, [])).toEqual({ ok: false, error: 'not_allowed' });

    expect(lobby.remove(me, sara.playerId)).toEqual({ ok: true });
    expect(lobby.playerFor(sara.token)).toBeNull();
    expect(lobby.remove(TABLE, noor.playerId)).toEqual({ ok: true });
    expect(players(lobby).map((p) => p.controller)).toEqual(['table', 'table']);
  });

  it('changes the playing order with all ids', () => {
    const { lobby } = openLobby();
    lobby.add(TABLE);
    const ids = players(lobby).map((p) => p.id);
    expect(lobby.reorder(TABLE, [ids[2], ids[0], ids[1]])).toEqual({ ok: true });
    expect(players(lobby).map((p) => p.id)).toEqual([ids[2], ids[0], ids[1]]);
    for (const bad of [null, [ids[0], ids[1]], [ids[0], ids[0], ids[1]], [ids[0], ids[1], 'x']]) {
      expect(lobby.reorder(TABLE, bad)).toEqual({ ok: false, error: 'invalid_input' });
    }
  });

  it('starts the game with the lobby ids and phone seats, and closes', () => {
    const { lobby, room } = openLobby('snoep');
    const [emma] = players(lobby);
    lobby.update(TABLE, emma!.id, { name: 'Emma' });
    const sara = join(lobby, 'Sara');

    expect(lobby.start(phone(sara.token))).toEqual({ ok: false, error: 'not_allowed' });
    expect(lobby.start(TABLE)).toEqual({ ok: true });
    expect(lobby.state).toBeNull();
    expect(room.theme).toBe('snoep');
    expect(room.state!.players.map((p) => [p.id, p.name])).toEqual([
      [emma!.id, 'Emma'],
      [sara.playerId, 'Sara'],
    ]);
    expect(room.playerFor(sara.token)).toBe(sara.playerId);
    expect(room.seats.map((s) => s.controller)).toEqual(['table', 'phone']);
  });

  it('stays open when the game rules refuse the players', () => {
    const { lobby } = openLobby();
    expect(lobby.start(TABLE)).toEqual({ ok: false, error: 'name_required' });
    expect(lobby.state).not.toBeNull();
  });

  it('can open again after a finished game', () => {
    const { lobby, room } = openLobby();
    const [a, b] = players(lobby);
    lobby.update(TABLE, a!.id, { name: 'Emma' });
    lobby.update(TABLE, b!.id, { name: 'Sara' });
    lobby.start(TABLE);
    for (let turn = 0; turn < 26; turn++) playTurn(room);
    expect(lobby.open(TABLE, 'voetbal')).toEqual({ ok: true });
  });
});
