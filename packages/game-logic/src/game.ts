import {
  DICE_COUNT,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_ROLLS,
  MIN_PLAYERS,
  ROUNDS,
} from './constants.js';
import { allowedBoxes, applyScore, emptyScorecard, totals } from './scoring.js';
import type { BoxId, Dice, DieValue, Held, Player, Rng, Scorecard } from './types.js';

export type GameStatus = 'in_progress' | 'finished' | 'aborted';

export interface GameState {
  /** Players in seat (playing) order. */
  readonly players: readonly Player[];
  /** Scorecards in the same order as players. */
  readonly scorecards: readonly Scorecard[];
  readonly currentPlayerIndex: number;
  /** Current round, 1 to 13. */
  readonly round: number;
  /** Null until the current player has rolled this turn. */
  readonly dice: Dice | null;
  readonly held: Held;
  readonly rollsUsed: number;
  readonly status: GameStatus;
}

export type SetupError =
  | 'too_few_players'
  | 'too_many_players'
  | 'duplicate_player_id'
  | 'name_required'
  | 'name_too_long'
  | 'duplicate_name';

export type MoveError =
  'game_over' | 'no_rolls_left' | 'not_rolled_yet' | 'invalid_die_index' | 'box_not_allowed';

export type Result<E> = { ok: true; state: GameState } | { ok: false; error: E };

const NOTHING_HELD: Held = [false, false, false, false, false];

function ok<E>(state: GameState): Result<E> {
  return { ok: true, state };
}

function fail<E>(error: E): Result<E> {
  return { ok: false, error };
}

/** Trims a name and collapses runs of whitespace inside it to one space. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function validatePlayers(players: readonly Player[]): SetupError | null {
  if (players.length < MIN_PLAYERS) return 'too_few_players';
  if (players.length > MAX_PLAYERS) return 'too_many_players';
  if (new Set(players.map((p) => p.id)).size !== players.length) return 'duplicate_player_id';

  const names = new Set<string>();
  for (const player of players) {
    const name = normalizeName(player.name);
    if (name.length === 0) return 'name_required';
    if (name.length > MAX_NAME_LENGTH) return 'name_too_long';
    const key = name.toLocaleLowerCase('nl');
    if (names.has(key)) return 'duplicate_name';
    names.add(key);
  }
  return null;
}

/**
 * Starts a game with 2 to 4 players. Names are normalized (see normalizeName) and must be
 * unique, ignoring upper/lower case.
 */
export function createGame(players: readonly Player[]): Result<SetupError> {
  const error = validatePlayers(players);
  if (error) return fail(error);

  return ok({
    players: players.map((player) => ({ ...player, name: normalizeName(player.name) })),
    scorecards: players.map(() => emptyScorecard()),
    currentPlayerIndex: 0,
    round: 1,
    dice: null,
    held: NOTHING_HELD,
    rollsUsed: 0,
    status: 'in_progress',
  });
}

function rollDie(rng: Rng): DieValue {
  return (Math.floor(rng() * 6) + 1) as DieValue;
}

/** Rolls all dice that are not held. */
export function roll(state: GameState, rng: Rng): Result<MoveError> {
  if (state.status !== 'in_progress') return fail('game_over');
  if (state.rollsUsed >= MAX_ROLLS) return fail('no_rolls_left');

  const previous = state.dice;
  const dice = state.held.map((isHeld, i) =>
    previous && isHeld ? previous[i] : rollDie(rng),
  ) as unknown as Dice;

  return ok({ ...state, dice, rollsUsed: state.rollsUsed + 1 });
}

/** Holds or releases one die. Only useful between rolls, so not after the last roll. */
export function toggleHold(state: GameState, index: number): Result<MoveError> {
  if (state.status !== 'in_progress') return fail('game_over');
  if (state.dice === null) return fail('not_rolled_yet');
  if (state.rollsUsed >= MAX_ROLLS) return fail('no_rolls_left');
  if (!Number.isInteger(index) || index < 0 || index >= DICE_COUNT) {
    return fail('invalid_die_index');
  }

  const held = state.held.map((isHeld, i) => (i === index ? !isHeld : isHeld)) as unknown as Held;
  return ok({ ...state, held });
}

/** Scores the current dice in a box and passes the turn to the next player. */
export function chooseBox(state: GameState, box: BoxId): Result<MoveError> {
  if (state.status !== 'in_progress') return fail('game_over');
  const { dice } = state;
  if (dice === null) return fail('not_rolled_yet');

  const current = state.scorecards[state.currentPlayerIndex] as Scorecard;
  if (!allowedBoxes(dice, current).includes(box)) return fail('box_not_allowed');

  const scorecards = state.scorecards.map((card, i) =>
    i === state.currentPlayerIndex ? applyScore(card, box, dice) : card,
  );

  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextRound = nextPlayerIndex === 0 ? state.round + 1 : state.round;
  const finished = nextRound > ROUNDS;

  return ok({
    ...state,
    scorecards,
    currentPlayerIndex: finished ? state.currentPlayerIndex : nextPlayerIndex,
    round: finished ? ROUNDS : nextRound,
    dice: null,
    held: NOTHING_HELD,
    rollsUsed: 0,
    status: finished ? 'finished' : 'in_progress',
  });
}

/** Stops the game early. An aborted game has no winner. */
export function abortGame(state: GameState): Result<MoveError> {
  if (state.status !== 'in_progress') return fail('game_over');
  return ok({ ...state, status: 'aborted' });
}

/** Grand total per player, in seat order. */
export function scores(state: GameState): number[] {
  return state.scorecards.map((card) => totals(card).grandTotal);
}

/** Ids of the winner(s) of a finished game; several on a tie, none if not finished. */
export function winners(state: GameState): string[] {
  if (state.status !== 'finished') return [];
  const all = scores(state);
  const best = Math.max(...all);
  return state.players.filter((_, i) => all[i] === best).map((player) => player.id);
}
