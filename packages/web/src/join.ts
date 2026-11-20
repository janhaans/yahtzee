import { useEffect, useState } from 'react';
import type { JoinAddress } from '@yahtzee/server/protocol';

/** The addresses phones can use to reach this laptop, best first. Empty when there are none. */
export async function fetchJoinAddresses(): Promise<JoinAddress[]> {
  try {
    const response = await fetch('/api/join');
    if (!response.ok) return [];
    return ((await response.json()) as { addresses: JoinAddress[] }).addresses;
  } catch {
    return [];
  }
}

/** Loads the addresses when `active` becomes true; undefined while loading. */
export function useJoinAddresses(active = true): JoinAddress[] | undefined {
  const [addresses, setAddresses] = useState<JoinAddress[] | undefined>(undefined);
  useEffect(() => {
    if (!active) return;
    let current = true;
    void fetchJoinAddresses().then((found) => {
      if (current) setAddresses(found);
    });
    return () => {
      current = false;
    };
  }, [active]);
  return addresses;
}

/** The address picked by hand if it still exists, otherwise the best one. */
export function pickAddress(addresses: readonly JoinAddress[], chosen: string): JoinAddress | null {
  return addresses.find((a) => a.address === chosen) ?? addresses[0] ?? null;
}
