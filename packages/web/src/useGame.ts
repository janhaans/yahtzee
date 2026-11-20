import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { BoxId, GameState } from '@yahtzee/game-logic';
import type {
  ActionResult,
  ClientToServerEvents,
  Hello,
  LobbyChange,
  LobbyState,
  SeatInfo,
  SeatResult,
  ServerToClientEvents,
  UnfinishedGame,
} from '@yahtzee/server/protocol';
import type { NewPlayer, ThemeId } from '@yahtzee/server/looks';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** What the server answered, or 'disconnected' when it did not answer in time. */
export type ClientResult = ActionResult | { ok: false; error: 'disconnected' };
export type ClientSeatResult = SeatResult | { ok: false; error: 'disconnected' };

export interface GameActions {
  roll(): Promise<ClientResult>;
  toggleHold(index: number): Promise<ClientResult>;
  chooseBox(box: BoxId): Promise<ClientResult>;
  abort(): Promise<ClientResult>;
  rematch(): Promise<ClientResult>;
  resume(): Promise<ClientResult>;
  discardUnfinished(): Promise<ClientResult>;
  /** Laptop: play the turn of a phone that has been offline for a while. */
  takeOver(): Promise<ClientResult>;
}

/** Setting up a new game together; the server checks who may do what. */
export interface LobbyActions {
  open(theme: ThemeId): Promise<ClientResult>;
  close(): Promise<ClientResult>;
  add(): Promise<ClientResult>;
  update(id: string, change: LobbyChange): Promise<ClientResult>;
  remove(id: string): Promise<ClientResult>;
  reorder(ids: readonly string[]): Promise<ClientResult>;
  start(): Promise<ClientResult>;
  /** Phone: join the new game. */
  join(player: NewPlayer): Promise<ClientSeatResult>;
  /** Phone, "Wie ben jij?": play this player of the running game. */
  claim(playerId: string): Promise<ClientSeatResult>;
}

const ACK_TIMEOUT_MS = 5000;

async function answer<R>(request: Promise<R>): Promise<R | { ok: false; error: 'disconnected' }> {
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
  /** The new game being set up on the laptop, or null. */
  readonly lobby: LobbyState | null;
  /** Where every player of the game plays, in playing order. */
  readonly seats: readonly SeatInfo[];
  /** On a phone: the player this phone plays, or null. */
  readonly you: string | null;
  /** A game that was still being played when the server stopped, waiting for a choice. */
  readonly unfinished: UnfinishedGame | null;
  /** True while the server could not save the game to the history. */
  readonly saveFailed: boolean;
  readonly actions: GameActions;
  readonly lobbyActions: LobbyActions;
}

/**
 * Connects to the game server. The server owns the state; we only send intentions.
 * `hello` is asked again on every (re)connect, so a phone always sends its latest token.
 */
export function useConnection(
  hello: () => Hello,
  onSeat?: (token: string) => void,
): GameConnection {
  // The socket lives as long as the page; `hello` and `onSeat` are read when needed.
  const latest = useRef({ hello, onSeat });
  latest.current = { hello, onSeat };
  const socket: GameSocket = useMemo(
    () => io({ autoConnect: false, auth: (send) => send(latest.current.hello()) }),
    [],
  );
  const [state, setState] = useState<GameState | null | undefined>(undefined);
  const [theme, setTheme] = useState<ThemeId | null>(null);
  const [connected, setConnected] = useState(false);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [seats, setSeats] = useState<readonly SeatInfo[]>([]);
  const [you, setYou] = useState<string | null>(null);
  const [unfinished, setUnfinished] = useState<UnfinishedGame | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('lobby:state', setLobby);
    socket.on('game:theme', setTheme);
    socket.on('game:seats', setSeats);
    socket.on('game:state', setState);
    socket.on('seat:you', setYou);
    socket.on('game:unfinished', setUnfinished);
    socket.on('history:saveFailed', setSaveFailed);
    socket.connect();
    // A phone that wakes up from a locked screen reconnects at once, instead of waiting for
    // the next retry.
    const wake = () => {
      if (document.visibilityState === 'visible' && !socket.connected) socket.connect();
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket]);

  const actions = useMemo<GameActions>(() => {
    const send = () => socket.timeout(ACK_TIMEOUT_MS);
    return {
      roll: () => answer(send().emitWithAck('game:roll')),
      toggleHold: (index) => answer(send().emitWithAck('game:toggleHold', { index })),
      chooseBox: (box) => answer(send().emitWithAck('game:chooseBox', { box })),
      abort: () => answer(send().emitWithAck('game:abort')),
      rematch: () => answer(send().emitWithAck('game:rematch')),
      resume: () => answer(send().emitWithAck('game:resume')),
      discardUnfinished: () => answer(send().emitWithAck('game:discardUnfinished')),
      takeOver: () => answer(send().emitWithAck('game:takeOver')),
    };
  }, [socket]);

  const lobbyActions = useMemo<LobbyActions>(() => {
    const send = () => socket.timeout(ACK_TIMEOUT_MS);
    const seated = async (request: Promise<SeatResult>) => {
      const result = await answer(request);
      if (result.ok) latest.current.onSeat?.(result.token);
      return result;
    };
    return {
      open: (theme) => answer(send().emitWithAck('lobby:open', { theme })),
      close: () => answer(send().emitWithAck('lobby:close')),
      add: () => answer(send().emitWithAck('lobby:add')),
      update: (id, change) => answer(send().emitWithAck('lobby:update', { id, change })),
      remove: (id) => answer(send().emitWithAck('lobby:remove', { id })),
      reorder: (ids) => answer(send().emitWithAck('lobby:reorder', { ids })),
      start: () => answer(send().emitWithAck('lobby:start')),
      join: (player) => seated(send().emitWithAck('lobby:join', player)),
      claim: (playerId) => seated(send().emitWithAck('seat:claim', { playerId })),
    };
  }, [socket]);

  return {
    state,
    theme,
    connected,
    lobby,
    seats,
    you,
    unfinished,
    saveFailed,
    actions,
    lobbyActions,
  };
}

const TABLE_HELLO = (): Hello => ({ role: 'table' });

/** The game table on the laptop. The server checks it really is the laptop. */
export function useGame(): GameConnection {
  return useConnection(TABLE_HELLO);
}
