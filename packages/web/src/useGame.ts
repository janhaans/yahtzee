import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { BoxId, GameState } from '@yahtzee/game-logic';
import type {
  ActionResult,
  ClientToServerEvents,
  ServerToClientEvents,
  UnfinishedGame,
} from '@yahtzee/server/protocol';
import type { GameSetup, ThemeId } from '@yahtzee/server/looks';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** What the server answered, or 'disconnected' when it did not answer in time. */
export type ClientResult = ActionResult | { ok: false; error: 'disconnected' };

export interface GameActions {
  create(setup: GameSetup): Promise<ClientResult>;
  roll(): Promise<ClientResult>;
  toggleHold(index: number): Promise<ClientResult>;
  chooseBox(box: BoxId): Promise<ClientResult>;
  abort(): Promise<ClientResult>;
  rematch(): Promise<ClientResult>;
  resume(): Promise<ClientResult>;
  discardUnfinished(): Promise<ClientResult>;
}

const ACK_TIMEOUT_MS = 5000;

async function answer(request: Promise<ActionResult>): Promise<ClientResult> {
  try {
    return await request;
  } catch {
    return { ok: false, error: 'disconnected' };
  }
}

export interface GameConnection {
  /** Undefined until the server has sent the first state. */
  readonly state: GameState | null | undefined;
  /** The theme of the game on the table; null when there is no game. */
  readonly theme: ThemeId | null;
  readonly connected: boolean;
  /** A game that was still being played when the server stopped, waiting for a choice. */
  readonly unfinished: UnfinishedGame | null;
  /** True while the server could not save the game to the history. */
  readonly saveFailed: boolean;
  readonly actions: GameActions;
}

/** Connects to the game server. The server owns the state; we only send intentions. */
export function useGame(): GameConnection {
  const socket: GameSocket = useMemo(() => io({ autoConnect: false }), []);
  const [state, setState] = useState<GameState | null | undefined>(undefined);
  const [theme, setTheme] = useState<ThemeId | null>(null);
  const [connected, setConnected] = useState(false);
  const [unfinished, setUnfinished] = useState<UnfinishedGame | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('game:theme', setTheme);
    socket.on('game:state', setState);
    socket.on('game:unfinished', setUnfinished);
    socket.on('history:saveFailed', setSaveFailed);
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket]);

  const actions = useMemo<GameActions>(() => {
    const send = () => socket.timeout(ACK_TIMEOUT_MS);
    return {
      create: (setup) => answer(send().emitWithAck('game:create', setup)),
      roll: () => answer(send().emitWithAck('game:roll')),
      toggleHold: (index) => answer(send().emitWithAck('game:toggleHold', { index })),
      chooseBox: (box) => answer(send().emitWithAck('game:chooseBox', { box })),
      abort: () => answer(send().emitWithAck('game:abort')),
      rematch: () => answer(send().emitWithAck('game:rematch')),
      resume: () => answer(send().emitWithAck('game:resume')),
      discardUnfinished: () => answer(send().emitWithAck('game:discardUnfinished')),
    };
  }, [socket]);

  return { state, theme, connected, unfinished, saveFailed, actions };
}
