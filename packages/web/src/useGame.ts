import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { BoxId, GameState } from '@yahtzee/game-logic';
import type {
  ActionResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@yahtzee/server/protocol';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** What the server answered, or 'disconnected' when it did not answer in time. */
export type ClientResult = ActionResult | { ok: false; error: 'disconnected' };

export interface GameActions {
  create(names: string[]): Promise<ClientResult>;
  roll(): Promise<ClientResult>;
  toggleHold(index: number): Promise<ClientResult>;
  chooseBox(box: BoxId): Promise<ClientResult>;
  abort(): Promise<ClientResult>;
  rematch(): Promise<ClientResult>;
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
  readonly connected: boolean;
  readonly actions: GameActions;
}

/** Connects to the game server. The server owns the state; we only send intentions. */
export function useGame(): GameConnection {
  const socket: GameSocket = useMemo(() => io({ autoConnect: false }), []);
  const [state, setState] = useState<GameState | null | undefined>(undefined);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('game:state', setState);
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket]);

  const actions = useMemo<GameActions>(() => {
    const send = () => socket.timeout(ACK_TIMEOUT_MS);
    return {
      create: (names) => answer(send().emitWithAck('game:create', { names })),
      roll: () => answer(send().emitWithAck('game:roll')),
      toggleHold: (index) => answer(send().emitWithAck('game:toggleHold', { index })),
      chooseBox: (box) => answer(send().emitWithAck('game:chooseBox', { box })),
      abort: () => answer(send().emitWithAck('game:abort')),
      rematch: () => answer(send().emitWithAck('game:rematch')),
    };
  }, [socket]);

  return { state, connected, actions };
}
