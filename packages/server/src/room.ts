import { randomUUID } from 'node:crypto';
import {
  BOX_IDS,
  abortGame,
  allowedBoxes,
  chooseBox,
  createGame,
  roll,
  toggleHold,
  type BoxId,
  type Dice,
  type GameState,
  type Player,
  type Result,
  type Rng,
  type SetupError,
} from '@yahtzee/game-logic';
import type { GameHistory, GameRecord, SavedGame, TurnRecord } from './history/store.js';
import {
  DEFAULT_THEME,
  isAvatar,
  isColour,
  isTheme,
  type GameSetup,
  type NewPlayer,
  type ThemeId,
} from './looks.js';
import { Presence } from './presence.js';
import {
  TAKE_OVER_AFTER_MS,
  type ActionError,
  type ActionResult,
  type SeatInfo,
  type SeatResult,
  type UnfinishedGame,
} from './protocol.js';

/** Who sends an intention: the laptop, or a phone with its seat token (if it has one). */
export type Actor =
  { readonly kind: 'table' } | { readonly kind: 'phone'; readonly token: string | null };

export const TABLE: Actor = { kind: 'table' };

/** A player's place in a new game: their id and, for a phone player, the seat token. */
export interface NewSeat {
  readonly id: string;
  readonly token: string | null;
}

/** A player's seat. Without a token the player plays on the laptop. */
interface Seat {
  token: string | null;
  /** The turn the laptop took over from an offline phone, if any. */
  takenOverTurn: string | null;
}

/** Identifies one turn, so a take-over ends by itself when the turn ends. */
function turnKey(state: GameState): string {
  return `${state.round}-${state.currentPlayerIndex}`;
}

const MAX_PLAYERS_IN_PAYLOAD = 10;

/** Checks the shape of a setup from the network. The game rules check names and counts. */
function isGameSetup(value: unknown): value is GameSetup {
  if (typeof value !== 'object' || value === null) return false;
  const { players, theme } = value as Record<string, unknown>;
  return (
    isTheme(theme) &&
    Array.isArray(players) &&
    players.length <= MAX_PLAYERS_IN_PAYLOAD &&
    players.every(
      (p: unknown) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as NewPlayer).name === 'string' &&
        isAvatar((p as NewPlayer).avatar) &&
        isColour((p as NewPlayer).colour),
    )
  );
}

function isBoxId(value: unknown): value is BoxId {
  return typeof value === 'string' && (BOX_IDS as readonly string[]).includes(value);
}

export interface RoomOptions {
  readonly history: GameHistory;
  readonly now?: () => Date;
  readonly newId?: () => string;
  readonly log?: (message: string, error: unknown) => void;
  /** Which phones are connected; the room only reads it. */
  readonly presence?: Presence;
}

/** History bookkeeping for the game on the table. */
interface CurrentGame {
  readonly id: string;
  readonly theme: ThemeId;
  /** Null until the first roll: only then does the game go into the history. */
  startedAt: string | null;
  turnRolls: Dice[];
  /** Turns that are not in the database yet. */
  unsavedTurns: TurnRecord[];
}

/**
 * Holds the one game on this laptop. Every intention from a client goes through here and
 * is checked against the game rules; the client is never trusted. After every change the
 * game is saved to the history.
 */
export class GameRoom {
  #state: GameState | null = null;
  #game: CurrentGame | null = null;
  #unfinished: SavedGame | null = null;
  /** Per player id. Players without a seat (a resumed game) play on the laptop. */
  #seats = new Map<string, Seat>();
  /** Saves that failed, per game id. They are tried again with every next save. */
  readonly #pending = new Map<string, GameRecord>();
  readonly #history: GameHistory;
  readonly #now: () => Date;
  readonly #newId: () => string;
  readonly #log: (message: string, error: unknown) => void;
  readonly #presence: Presence;

  constructor(
    private readonly rng: Rng,
    options: RoomOptions,
  ) {
    this.#history = options.history;
    this.#now = options.now ?? (() => new Date());
    this.#newId = options.newId ?? randomUUID;
    this.#log = options.log ?? ((message, error) => console.error(message, error));
    this.#presence = options.presence ?? new Presence(this.#now);
    try {
      this.#unfinished = this.#history.findUnfinished();
    } catch (error) {
      this.#log('Could not look for an unfinished game.', error);
    }
  }

  /** Which phones are connected. The app updates it as sockets come and go. */
  get presence(): Presence {
    return this.#presence;
  }

  get state(): GameState | null {
    return this.#state;
  }

  /** The theme of the game on the table, or null when there is none. */
  get theme(): ThemeId | null {
    return this.#game?.theme ?? null;
  }

  /** The game that was still being played when the server stopped, until someone chooses. */
  get unfinished(): UnfinishedGame | null {
    const saved = this.#unfinished;
    if (saved === null) return null;
    return { players: saved.state.players, round: saved.state.round, startedAt: saved.startedAt };
  }

  /** Where every player of the game plays, in playing order. Empty without a game. */
  get seats(): readonly SeatInfo[] {
    const state = this.#state;
    if (state === null) return [];
    const turn = state.status === 'in_progress' ? turnKey(state) : null;
    return state.players.map((player) => {
      const seat = this.#seats.get(player.id);
      const token = seat?.token ?? null;
      return {
        playerId: player.id,
        controller: token === null ? 'table' : 'phone',
        online: token === null || this.#presence.isOnline(token),
        offlineSince: token === null ? null : this.#presence.offlineSince(token),
        takenOver: turn !== null && seat?.takenOverTurn === turn,
      };
    });
  }

  /** The player a phone plays, by its seat token. */
  playerFor(token: string | null): string | null {
    if (token === null) return null;
    for (const [id, seat] of this.#seats) if (seat.token === token) return id;
    return null;
  }

  /** True while a game could not be saved to the history yet. */
  get saveFailed(): boolean {
    return this.#pending.size > 0;
  }

  /** True when a new game may start now. */
  canCreate(): ActionResult {
    if (this.#unfinished) return fail('unfinished_game');
    if (this.#state?.status === 'in_progress') return fail('game_in_progress');
    return { ok: true };
  }

  /**
   * Starts a new game. `seats` gives the ids and phone tokens per player, in the same
   * order; players without one get a new id and play on the laptop.
   */
  create(setup: unknown, seats: readonly NewSeat[] = []): ActionResult {
    const allowed = this.canCreate();
    if (!allowed.ok) return allowed;
    if (!isGameSetup(setup)) return fail('invalid_input');

    const players: Player[] = setup.players.map(({ name, avatar, colour }, i) => ({
      id: seats[i]?.id ?? this.#newId(),
      name,
      avatar,
      colour,
      type: 'human',
    }));
    const result = createGame(players);
    if (result.ok && new Set(players.map((p) => p.colour)).size !== players.length) {
      return fail('duplicate_colour');
    }
    if (!result.ok) return result;
    this.#seats = new Map(
      players.map((p, i) => [p.id, { token: seats[i]?.token ?? null, takenOverTurn: null }]),
    );
    return this.#begin(result, setup.theme);
  }

  rematch(): ActionResult {
    if (this.#state === null) return fail('no_game');
    if (this.#state.status !== 'finished') return fail('game_not_finished');
    // Same players, same seats: phone players keep playing on their phone.
    for (const seat of this.#seats.values()) seat.takenOverTurn = null;
    return this.#begin(createGame(this.#state.players), this.#game!.theme);
  }

  resume(): ActionResult {
    const saved = this.#unfinished;
    if (saved === null) return fail('no_unfinished_game');
    this.#unfinished = null;
    this.#state = saved.state;
    // Seat tokens did not survive the restart: everyone starts on the laptop, and phones
    // take their player back with "Wie ben jij?".
    this.#seats = new Map();
    this.#game = {
      id: saved.id,
      theme: isTheme(saved.theme) ? saved.theme : DEFAULT_THEME,
      startedAt: saved.startedAt,
      turnRolls: [...saved.turnRolls],
      unsavedTurns: [],
    };
    return { ok: true };
  }

  /** Stops the unfinished game. It ends at its last save, not now, so the duration is honest. */
  discardUnfinished(): ActionResult {
    const saved = this.#unfinished;
    if (saved === null) return fail('no_unfinished_game');
    this.#unfinished = null;
    this.#pending.set(saved.id, {
      id: saved.id,
      state: { ...saved.state, status: 'aborted' },
      startedAt: saved.startedAt,
      savedAt: saved.savedAt,
      endedAt: saved.savedAt,
      theme: saved.theme,
      turnRolls: [],
      turns: [],
    });
    this.#flush();
    return { ok: true };
  }

  roll(actor: Actor = TABLE): ActionResult {
    return this.#move(
      actor,
      (state) => roll(state, this.rng),
      (state, _before, at) => {
        const game = this.#game!;
        game.startedAt ??= at;
        game.turnRolls.push(state.dice!);
      },
    );
  }

  toggleHold(index: unknown, actor: Actor = TABLE): ActionResult {
    if (typeof index !== 'number') return fail('invalid_input');
    return this.#move(actor, (state) => toggleHold(state, index));
  }

  chooseBox(box: unknown, actor: Actor = TABLE): ActionResult {
    if (!isBoxId(box)) return fail('invalid_input');
    return this.#move(
      actor,
      (state) => {
        // Re-check on the server, including the Joker rule, whatever the client showed.
        const card = state.scorecards[state.currentPlayerIndex]!;
        if (state.dice === null) return { ok: false, error: 'not_rolled_yet' };
        if (!allowedBoxes(state.dice, card).includes(box)) {
          return { ok: false, error: 'box_not_allowed' };
        }
        return chooseBox(state, box);
      },
      (state, before, at) => {
        const game = this.#game!;
        const seat = before.currentPlayerIndex;
        game.unsavedTurns.push({
          round: before.round,
          seat,
          rolls: game.turnRolls,
          box,
          points: state.scorecards[seat]!.boxes[box]!,
          playedAt: at,
        });
        game.turnRolls = [];
      },
    );
  }

  /** Stopping is for the laptop only; the app checks that before calling. */
  abort(): ActionResult {
    return this.#move(null, abortGame);
  }

  /**
   * "Wie ben jij?": a phone takes over a player of the running game. Allowed for laptop
   * players and for phone players whose phone is offline. Returns the new seat token; the
   * old one stops working.
   */
  claim(playerId: unknown): SeatResult {
    const state = this.#state;
    if (state?.status !== 'in_progress') return fail('no_game');
    const player = state.players.find((p) => p.id === playerId);
    if (player === undefined) return fail('invalid_input');
    const seat = this.#seats.get(player.id) ?? { token: null, takenOverTurn: null };
    if (seat.token !== null && this.#presence.isOnline(seat.token)) return fail('seat_taken');
    const token = this.#newId();
    this.#seats.set(player.id, { token, takenOverTurn: null });
    return { ok: true, playerId: player.id, token };
  }

  /**
   * The laptop plays the current turn for a phone that has been offline for a while.
   * The phone gets its player back at the next turn.
   */
  takeOver(): ActionResult {
    const state = this.#state;
    if (state?.status !== 'in_progress') return fail('no_game');
    const seat = this.#seats.get(state.players[state.currentPlayerIndex]!.id);
    if (!seat?.token) return fail('not_allowed');
    const since = this.#presence.offlineSince(seat.token);
    if (since === null || this.#now().getTime() - Date.parse(since) < TAKE_OVER_AFTER_MS) {
      return fail('too_early');
    }
    seat.takenOverTurn = turnKey(state);
    return { ok: true };
  }

  /** Whether this actor may play the current turn. */
  #mayPlay(actor: Actor, state: GameState): boolean {
    const seat = this.#seats.get(state.players[state.currentPlayerIndex]!.id);
    const token = seat?.token ?? null;
    if (token === null) return actor.kind === 'table';
    if (actor.kind === 'phone') return actor.token === token;
    return seat!.takenOverTurn === turnKey(state);
  }

  #begin(result: Result<SetupError>, theme: ThemeId): ActionResult {
    if (!result.ok) return fail(result.error);
    this.#state = result.state;
    this.#game = { id: this.#newId(), theme, startedAt: null, turnRolls: [], unsavedTurns: [] };
    return { ok: true };
  }

  /**
   * The single path for every move in a game, so a computer player can use it later too.
   * The actor must be allowed to play this turn (null: no check, for stopping the game).
   * `after` updates the history bookkeeping; then the game is saved.
   */
  #move(
    actor: Actor | null,
    step: (state: GameState) => Result<ActionError>,
    after?: (state: GameState, before: GameState, at: string) => void,
  ): ActionResult {
    const before = this.#state;
    if (before === null) return fail('no_game');
    if (actor && before.status === 'in_progress' && !this.#mayPlay(actor, before)) {
      return fail('not_your_turn');
    }
    const result = step(before);
    if (!result.ok) return fail(result.error);

    const at = this.#now().toISOString();
    this.#state = result.state;
    after?.(result.state, before, at);
    this.#save(at);
    return { ok: true };
  }

  #save(at: string): void {
    const game = this.#game!;
    const state = this.#state!;
    // A game only goes into the history at its first roll.
    if (game.startedAt !== null) {
      this.#pending.set(game.id, {
        id: game.id,
        state,
        startedAt: game.startedAt,
        savedAt: at,
        endedAt: state.status === 'in_progress' ? null : at,
        theme: game.theme,
        turnRolls: [...game.turnRolls],
        turns: [...game.unsavedTurns],
      });
    }
    this.#flush();
  }

  /** Saves everything still waiting. A failed save stays waiting for the next turn. */
  #flush(): void {
    for (const [id, record] of this.#pending) {
      try {
        this.#history.save(record);
        this.#pending.delete(id);
        if (this.#game?.id === id) {
          this.#game.unsavedTurns = this.#game.unsavedTurns.slice(record.turns.length);
        }
      } catch (error) {
        this.#log(`Could not save game ${id}; trying again after the next turn.`, error);
      }
    }
  }
}

function fail(error: ActionError): { ok: false; error: ActionError } {
  return { ok: false, error };
}
