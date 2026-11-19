import { useEffect, useRef } from 'react';
import type { GameState } from '@yahtzee/game-logic';
import { gameEvents, type GameEvent } from './fun/events';

/**
 * Calls `onEvents` with what happened every time a new state arrives. The first state after
 * connecting gives no events, so reconnecting never replays a celebration.
 */
export function useGameEvents(
  state: GameState | null | undefined,
  onEvents: (events: GameEvent[]) => void,
): void {
  const previous = useRef<GameState | null | undefined>(undefined);
  const handler = useRef(onEvents);
  useEffect(() => {
    handler.current = onEvents;
  });

  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (before === undefined || state === undefined) return;
    const events = gameEvents(before, state);
    if (events.length > 0) handler.current(events);
  }, [state]);
}
