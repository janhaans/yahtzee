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
import type { ActionError, ActionResult, UnfinishedGame } from './protocol.js';

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
  /** Saves that failed, per game id. They are tried again with every next save. */
  readonly #pending = new Map<string, GameRecord>();
  readonly #history: GameHistory;
  readonly #now: () => Date;
  readonly #newId: () => string;
  readonly #log: (message: string, error: unknown) => void;

  constructor(
    private readonly rng: Rng,
    options: RoomOptions,
  ) {
    this.#history = options.history;
    this.#now = options.now ?? (() => new Date());
    this.#newId = options.newId ?? randomUUID;
    this.#log = options.log ?? ((message, error) => console.error(message, error));
    try {
      this.#unfinished = this.#history.findUnfinished();
    } catch (error) {
      this.#log('Could not look for an unfinished game.', error);
    }
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

  /** True while a game could not be saved to the history yet. */
  get saveFailed(): boolean {
    return this.#pending.size > 0;
  }

  create(setup: unknown): ActionResult {
    if (this.#unfinished) return fail('unfinished_game');
    if (this.#state?.status === 'in_progress') return fail('game_in_progress');
    if (!isGameSetup(setup)) return fail('invalid_input');

    const players: Player[] = setup.players.map(({ name, avatar, colour }) => ({
      id: this.#newId(),
      name,
      avatar,
      colour,
      type: 'human',
    }));
    const result = createGame(players);
    if (result.ok && new Set(players.map((p) => p.colour)).size !== players.length) {
      return fail('duplicate_colour');
    }
    return this.#begin(result, setup.theme);
  }

  rematch(): ActionResult {
    if (this.#state === null) return fail('no_game');
    if (this.#state.status !== 'finished') return fail('game_not_finished');
    return this.#begin(createGame(this.#state.players), this.#game!.theme);
  }

  resume(): ActionResult {
    const saved = this.#unfinished;
    if (saved === null) return fail('no_unfinished_game');
    this.#unfinished = null;
    this.#state = saved.state;
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

  roll(): ActionResult {
    return this.#move(
      (state) => roll(state, this.rng),
      (state, _before, at) => {
        const game = this.#game!;
        game.startedAt ??= at;
        game.turnRolls.push(state.dice!);
      },
    );
  }

  toggleHold(index: unknown): ActionResult {
    if (typeof index !== 'number') return fail('invalid_input');
    return this.#move((state) => toggleHold(state, index));
  }

  chooseBox(box: unknown): ActionResult {
    if (!isBoxId(box)) return fail('invalid_input');
    return this.#move(
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

  abort(): ActionResult {
    return this.#move(abortGame);
  }

  #begin(result: Result<SetupError>, theme: ThemeId): ActionResult {
    if (!result.ok) return fail(result.error);
    this.#state = result.state;
    this.#game = { id: this.#newId(), theme, startedAt: null, turnRolls: [], unsavedTurns: [] };
    return { ok: true };
  }

  /**
   * The single path for every move in a game, so a computer player can use it later too.
   * `after` updates the history bookkeeping; then the game is saved.
   */
  #move(
    step: (state: GameState) => Result<ActionError>,
    after?: (state: GameState, before: GameState, at: string) => void,
  ): ActionResult {
    const before = this.#state;
    if (before === null) return fail('no_game');
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

function fail(error: ActionError): ActionResult {
  return { ok: false, error };
}
