import type { GameState, MoveError, SetupError } from '@yahtzee/game-logic';

/**
 * Socket.IO events between the clients and the server. Clients only send intentions;
 * the server checks them, changes the game state and broadcasts the new state.
 */

export type ActionError =
  SetupError | MoveError | 'no_game' | 'game_in_progress' | 'game_not_finished' | 'invalid_input';

export type ActionResult = { ok: true } | { ok: false; error: ActionError };

export type Ack = (result: ActionResult) => void;

export interface ClientToServerEvents {
  /** Start a new game. Names are in playing order; the server fills in the rest. */
  'game:create': (payload: { names: string[] }, ack: Ack) => void;
  'game:roll': (ack: Ack) => void;
  'game:toggleHold': (payload: { index: number }, ack: Ack) => void;
  'game:chooseBox': (payload: { box: string }, ack: Ack) => void;
  'game:abort': (ack: Ack) => void;
  /** Start a new game with the same players after a finished game. */
  'game:rematch': (ack: Ack) => void;
}

export interface ServerToClientEvents {
  /** The full game state, sent on connect and after every change. Null when there is no game. */
  'game:state': (state: GameState | null) => void;
}
