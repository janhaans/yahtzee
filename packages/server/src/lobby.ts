import { randomUUID } from 'node:crypto';
import {
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  nameKey,
  normalizeName,
} from '@yahtzee/game-logic';
import {
  defaultAvatar,
  freeColour,
  isAvatar,
  isColour,
  isTheme,
  type AvatarId,
  type Colour,
  type ThemeId,
} from './looks.js';
import type { Presence } from './presence.js';
import type { ActionError, ActionResult, LobbyState, SeatResult } from './protocol.js';
import type { Actor, GameRoom } from './room.js';

/** A player in the lobby. Without a token the player plays on the laptop. */
interface Entry {
  readonly id: string;
  name: string;
  avatar: AvatarId;
  colour: Colour;
  readonly token: string | null;
}

interface Open {
  readonly theme: ThemeId;
  entries: Entry[];
}

/**
 * The new game while the laptop sets it up. The laptop adds laptop players, phones join by
 * themselves; everyone sees the same list. The game rules check the names again at the start.
 */
export class Lobby {
  #open: Open | null = null;
  readonly #presence: Presence;
  readonly #newId: () => string;

  constructor(
    private readonly room: GameRoom,
    options: { newId?: () => string } = {},
  ) {
    this.#presence = room.presence;
    this.#newId = options.newId ?? randomUUID;
  }

  get state(): LobbyState | null {
    const open = this.#open;
    if (open === null) return null;
    return {
      theme: open.theme,
      players: open.entries.map(({ id, name, avatar, colour, token }) => ({
        id,
        name,
        avatar,
        colour,
        controller: token === null ? 'table' : 'phone',
        online: token === null || this.#presence.isOnline(token),
      })),
    };
  }

  /** The lobby player a phone is, by its seat token. */
  playerFor(token: string | null): string | null {
    if (token === null) return null;
    return this.#open?.entries.find((e) => e.token === token)?.id ?? null;
  }

  /** Opens a fresh lobby with two empty laptop players. */
  open(actor: Actor, theme: unknown): ActionResult {
    if (actor.kind !== 'table') return fail('not_allowed');
    if (!isTheme(theme)) return fail('invalid_input');
    const allowed = this.room.canCreate();
    if (!allowed.ok) return allowed;
    this.#open = { theme, entries: [] };
    this.#pad();
    return { ok: true };
  }

  close(actor: Actor): ActionResult {
    if (actor.kind !== 'table') return fail('not_allowed');
    this.#open = null;
    return { ok: true };
  }

  /** One more empty laptop player. */
  add(actor: Actor): ActionResult {
    return this.#change(actor, (open) => {
      if (actor.kind !== 'table') return 'not_allowed';
      if (open.entries.length >= MAX_PLAYERS) return 'too_many_players';
      open.entries.push(this.#newEntry(open));
      return null;
    });
  }

  /**
   * The laptop changes laptop players, a phone only its own player. A phone player always
   * keeps a valid, unique name, so the laptop never has to fix it.
   */
  update(actor: Actor, id: unknown, change: unknown): ActionResult {
    return this.#change(actor, (open) => {
      const entry = open.entries.find((e) => e.id === id);
      if (entry === undefined || typeof change !== 'object' || change === null) {
        return 'invalid_input';
      }
      const mine = actor.kind === 'table' ? entry.token === null : actor.token === entry.token;
      if (!mine) return 'not_allowed';
      const { name, avatar, colour } = change as Record<string, unknown>;
      if (
        (name !== undefined && typeof name !== 'string') ||
        (avatar !== undefined && !isAvatar(avatar)) ||
        (colour !== undefined && !isColour(colour))
      ) {
        return 'invalid_input';
      }
      if (colour !== undefined && open.entries.some((e) => e !== entry && e.colour === colour)) {
        return 'duplicate_colour';
      }
      if (name !== undefined) {
        if (entry.token === null) {
          entry.name = name.slice(0, MAX_NAME_LENGTH);
        } else {
          const error = nameError(open, name, entry);
          if (error) return error;
          entry.name = normalizeName(name);
        }
      }
      if (avatar !== undefined) entry.avatar = avatar;
      if (colour !== undefined) entry.colour = colour;
      return null;
    });
  }

  /** The laptop removes anyone, a phone itself. There are always at least two rows. */
  remove(actor: Actor, id: unknown): ActionResult {
    return this.#change(actor, (open) => {
      const entry = open.entries.find((e) => e.id === id);
      if (entry === undefined) return 'invalid_input';
      if (actor.kind !== 'table' && actor.token !== entry.token) return 'not_allowed';
      open.entries = open.entries.filter((e) => e !== entry);
      this.#pad();
      return null;
    });
  }

  /** A new playing order: the same ids in a different order. */
  reorder(actor: Actor, ids: unknown): ActionResult {
    return this.#change(actor, (open) => {
      if (actor.kind !== 'table') return 'not_allowed';
      const entries = Array.isArray(ids)
        ? ids.map((id: unknown) => open.entries.find((e) => e.id === id))
        : [];
      if (
        entries.length !== open.entries.length ||
        new Set(entries).size !== entries.length ||
        entries.includes(undefined)
      ) {
        return 'invalid_input';
      }
      open.entries = entries as Entry[];
      return null;
    });
  }

  /**
   * A phone joins. It takes the place of the first laptop player without a name (the empty
   * rows the lobby starts with), or comes last. Answers with this phone's new seat token.
   */
  join(actor: Actor, player: unknown): SeatResult {
    const open = this.#open;
    if (open === null) return fail('no_lobby');
    if (actor.kind !== 'phone') return fail('not_allowed');
    if (typeof player !== 'object' || player === null) return fail('invalid_input');
    const { name, avatar, colour } = player as Record<string, unknown>;
    if (typeof name !== 'string' || !isAvatar(avatar) || !isColour(colour)) {
      return fail('invalid_input');
    }
    const error = nameError(open, name, null);
    if (error) return fail(error);
    if (open.entries.some((e) => e.colour === colour)) return fail('duplicate_colour');

    const empty = open.entries.findIndex((e) => e.token === null && nameKey(e.name) === '');
    if (empty === -1 && open.entries.length >= MAX_PLAYERS) return fail('too_many_players');
    const token = this.#newId();
    const entry: Entry = { id: this.#newId(), name: normalizeName(name), avatar, colour, token };
    if (empty === -1) open.entries.push(entry);
    else open.entries[empty] = entry;
    return { ok: true, playerId: entry.id, token };
  }

  /** Starts the game with everyone in the lobby. Phones keep their tokens as seats. */
  start(actor: Actor): ActionResult {
    const open = this.#open;
    if (open === null) return fail('no_lobby');
    if (actor.kind !== 'table') return fail('not_allowed');
    const result = this.room.create(
      {
        theme: open.theme,
        players: open.entries.map(({ name, avatar, colour }) => ({ name, avatar, colour })),
      },
      open.entries.map(({ id, token }) => ({ id, token })),
    );
    if (result.ok) this.#open = null;
    return result;
  }

  #change(actor: Actor, change: (open: Open) => ActionError | null): ActionResult {
    const open = this.#open;
    if (open === null) return fail('no_lobby');
    const error = change(open);
    return error ? fail(error) : { ok: true };
  }

  #newEntry(open: Open): Entry {
    return {
      id: this.#newId(),
      name: '',
      avatar: defaultAvatar(open.theme, open.entries.length),
      colour: freeColour(open.entries.map((e) => e.colour)),
      token: null,
    };
  }

  /** Tops the lobby up to the minimum number of players with empty laptop rows. */
  #pad(): void {
    const open = this.#open!;
    while (open.entries.length < MIN_PLAYERS) open.entries.push(this.#newEntry(open));
  }
}

/** Why a phone player's name cannot be used, or null. */
function nameError(open: Open, name: string, self: Entry | null): ActionError | null {
  const clean = normalizeName(name);
  if (clean.length === 0) return 'name_required';
  if (clean.length > MAX_NAME_LENGTH) return 'name_too_long';
  const key = nameKey(clean);
  if (open.entries.some((e) => e !== self && nameKey(e.name) === key)) return 'duplicate_name';
  return null;
}

function fail(error: ActionError): { ok: false; error: ActionError } {
  return { ok: false, error };
}
