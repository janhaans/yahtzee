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
import type { ActionError, ActionResult, UnfinishedGame } from './protocol.js';

/** Avatar and colour per seat, until players can pick their own in milestone 4. */
const DEFAULT_LOOKS = [
  { avatar: 'cupcake', colour: '#e8457c' },
  { avatar: 'football', colour: '#2e8b57' },
  { avatar: 'lollipop', colour: '#7b4fd6' },
  { avatar: 'trophy', colour: '#e08a00' },
] as const;

const MAX_NAMES = 10;

function isNameList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.length <= MAX_NAMES && value.every((n) => typeof n === 'string')
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

  create(names: unknown): ActionResult {
    if (this.#unfinished) return fail('unfinished_game');
    if (this.#state?.status === 'in_progress') return fail('game_in_progress');
    if (!isNameList(names)) return fail('invalid_input');

    const players: Player[] = names.map((name, i) => ({
      id: this.#newId(),
      name,
      ...DEFAULT_LOOKS[i % DEFAULT_LOOKS.length]!,
      type: 'human',
    }));
    return this.#begin(createGame(players));
  }

  rematch(): ActionResult {
    if (this.#state === null) return fail('no_game');
    if (this.#state.status !== 'finished') return fail('game_not_finished');
    return this.#begin(createGame(this.#state.players));
  }

  resume(): ActionResult {
    const saved = this.#unfinished;
    if (saved === null) return fail('no_unfinished_game');
    this.#unfinished = null;
    this.#state = saved.state;
    this.#game = {
      id: saved.id,
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
      theme: null,
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

  #begin(result: Result<SetupError>): ActionResult {
    if (!result.ok) return fail(result.error);
    this.#state = result.state;
    this.#game = { id: this.#newId(), startedAt: null, turnRolls: [], unsavedTurns: [] };
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
        theme: null,
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
