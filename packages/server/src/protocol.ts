import type { GameState, MoveError, Player, SetupError } from '@yahtzee/game-logic';
import type { GameSetup, ThemeId } from './looks.js';

/**
 * Socket.IO events between the clients and the server. Clients only send intentions;
 * the server checks them, changes the game state and broadcasts the new state.
 */

export type ActionError =
  | SetupError
  | MoveError
  | 'no_game'
  | 'game_in_progress'
  | 'game_not_finished'
  | 'invalid_input'
  | 'duplicate_colour'
  | 'unfinished_game'
  | 'no_unfinished_game'
  /** Only the laptop may do this (start, stop, take over a turn...). */
  | 'not_allowed'
  /** A phone tried to play for someone else. */
  | 'not_your_turn'
  /** "Wie ben jij?": that player is still playing on another phone. */
  | 'seat_taken'
  /** The laptop can only take over a turn after the phone was gone for a while. */
  | 'too_early';

export type ActionResult = { ok: true } | { ok: false; error: ActionError };

export type Ack = (result: ActionResult) => void;

/** Where a player plays: on the laptop (pass-and-play) or on their own phone. */
export type Controller = 'table' | 'phone';

/** How long a phone must be gone before the laptop may play its turn. */
export const TAKE_OVER_AFTER_MS = 15_000;

/** What every screen knows about a player's seat. The phone's token is never sent. */
export interface SeatInfo {
  readonly playerId: string;
  readonly controller: Controller;
  /** Always true for laptop players. */
  readonly online: boolean;
  /** ISO time in UTC since the phone lost its connection; null while online. */
  readonly offlineSince: string | null;
  /** True while the laptop plays this turn for an offline phone. */
  readonly takenOver: boolean;
}

/** A seat token for a phone, after joining or after "Wie ben jij?". */
export type SeatResult =
  { ok: true; playerId: string; token: string } | { ok: false; error: ActionError };

/** How a screen introduces itself when it connects (Socket.IO `auth`). */
export type Hello = { role: 'table' } | { role: 'phone'; token?: string | null };

/** A game that was still being played when the server stopped. */
export interface UnfinishedGame {
  readonly players: readonly Player[];
  readonly round: number;
  /** ISO time in UTC. */
  readonly startedAt: string;
}

export interface ClientToServerEvents {
  /** Start a new game. Players are in playing order; the server adds ids and types. */
  'game:create': (payload: GameSetup, ack: Ack) => void;
  'game:roll': (ack: Ack) => void;
  'game:toggleHold': (payload: { index: number }, ack: Ack) => void;
  'game:chooseBox': (payload: { box: string }, ack: Ack) => void;
  'game:abort': (ack: Ack) => void;
  /** Start a new game with the same players after a finished game. */
  'game:rematch': (ack: Ack) => void;
  /** Continue the unfinished game found when the server started. */
  'game:resume': (ack: Ack) => void;
  /** Stop the unfinished game: it is saved as aborted. */
  'game:discardUnfinished': (ack: Ack) => void;
  /** Laptop: play the current turn for a phone that has been offline for a while. */
  'game:takeOver': (ack: Ack) => void;
  /** Phone, "Wie ben jij?": play this player of the running game on this phone. */
  'seat:claim': (payload: { playerId: string }, ack: (result: SeatResult) => void) => void;
}

export interface ServerToClientEvents {
  /** The full game state, sent on connect and after every change. Null when there is no game. */
  'game:state': (state: GameState | null) => void;
  /** The theme of the game on the table, sent before its state. Null when there is no game. */
  'game:theme': (theme: ThemeId | null) => void;
  /** The unfinished game waiting for a choice (continue or stop), or null. */
  'game:unfinished': (game: UnfinishedGame | null) => void;
  /** True while a save to the history failed; it is tried again after the next turn. */
  'history:saveFailed': (failed: boolean) => void;
  /** Where every player of the game plays, in playing order. */
  'game:seats': (seats: readonly SeatInfo[]) => void;
  /** Only to phones: the player this phone plays, or null. */
  'seat:you': (playerId: string | null) => void;
}
