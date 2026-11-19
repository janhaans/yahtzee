import { useEffect, useState } from 'react';
import type { PlayerSummary } from '@yahtzee/server/api';

/** Names of the players who played most recently. Empty when the server cannot tell. */
export async function fetchRecentNames(): Promise<string[]> {
  try {
    const response = await fetch('/api/players/recent');
    if (!response.ok) return [];
    const players = (await response.json()) as PlayerSummary[];
    return players.map((player) => player.name);
  } catch {
    return [];
  }
}

/** Loads the recent names each time `active` becomes true (when setup opens). */
export function useRecentNames(active: boolean): string[] {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    if (!active) return;
    let current = true;
    void fetchRecentNames().then((found) => {
      if (current) setNames(found);
    });
    return () => {
      current = false;
    };
  }, [active]);
  return names;
}
