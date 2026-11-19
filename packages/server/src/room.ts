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
  type GameState,
  type Player,
  type Result,
  type Rng,
} from '@yahtzee/game-logic';
import type { ActionError, ActionResult } from './protocol.js';

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

/**
 * Holds the one game on this laptop. Every intention from a client goes through here and
 * is checked against the game rules; the client is never trusted.
 */
export class GameRoom {
  #state: GameState | null = null;

  constructor(
    private readonly rng: Rng,
    private readonly newId: () => string = randomUUID,
  ) {}

  get state(): GameState | null {
    return this.#state;
  }

  create(names: unknown): ActionResult {
    if (this.#state?.status === 'in_progress') return fail('game_in_progress');
    if (!isNameList(names)) return fail('invalid_input');

    const players: Player[] = names.map((name, i) => ({
      id: this.newId(),
      name,
      ...DEFAULT_LOOKS[i % DEFAULT_LOOKS.length]!,
      type: 'human',
    }));
    return this.#apply(createGame(players));
  }

  rematch(): ActionResult {
    if (this.#state === null) return fail('no_game');
    if (this.#state.status !== 'finished') return fail('game_not_finished');
    return this.#apply(createGame(this.#state.players));
  }

  roll(): ActionResult {
    return this.#move((state) => roll(state, this.rng));
  }

  toggleHold(index: unknown): ActionResult {
    if (typeof index !== 'number') return fail('invalid_input');
    return this.#move((state) => toggleHold(state, index));
  }

  chooseBox(box: unknown): ActionResult {
    if (!isBoxId(box)) return fail('invalid_input');
    return this.#move((state) => {
      // Re-check on the server, including the Joker rule, whatever the client showed.
      const card = state.scorecards[state.currentPlayerIndex]!;
      if (state.dice === null) return { ok: false, error: 'not_rolled_yet' };
      if (!allowedBoxes(state.dice, card).includes(box)) {
        return { ok: false, error: 'box_not_allowed' };
      }
      return chooseBox(state, box);
    });
  }

  abort(): ActionResult {
    return this.#move(abortGame);
  }

  /** The single path for every move in a game, so a computer player can use it later too. */
  #move(step: (state: GameState) => Result<ActionError>): ActionResult {
    if (this.#state === null) return fail('no_game');
    return this.#apply(step(this.#state));
  }

  #apply(result: Result<ActionError>): ActionResult {
    if (!result.ok) return fail(result.error);
    this.#state = result.state;
    return { ok: true };
  }
}

function fail(error: ActionError): ActionResult {
  return { ok: false, error };
}
