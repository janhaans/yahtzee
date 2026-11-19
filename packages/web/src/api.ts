import { useEffect, useState } from 'react';
import type { PlayerSummary } from '@yahtzee/server/api';

/** A player from an earlier game, with the avatar and colour they used last. */
export type RecentPlayer = Pick<PlayerSummary, 'name' | 'avatar' | 'colour'>;

/** The players who played most recently. Empty when the server cannot tell. */
export async function fetchRecentPlayers(): Promise<RecentPlayer[]> {
  try {
    const response = await fetch('/api/players/recent');
    if (!response.ok) return [];
    const players = (await response.json()) as PlayerSummary[];
    return players.map(({ name, avatar, colour }) => ({ name, avatar, colour }));
  } catch {
    return [];
  }
}

/** Loads the recent players each time `active` becomes true (when setup opens). */
export function useRecentPlayers(active: boolean): RecentPlayer[] {
  const [players, setPlayers] = useState<RecentPlayer[]>([]);
  useEffect(() => {
    if (!active) return;
    let current = true;
    void fetchRecentPlayers().then((found) => {
      if (current) setPlayers(found);
    });
    return () => {
      current = false;
    };
  }, [active]);
  return players;
}
