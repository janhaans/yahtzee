import { useCallback, useState } from 'react';
import { DEFAULT_THEME, isTheme, type ThemeId } from '@yahtzee/server/looks';

/**
 * Settings of this device (theme, sound), kept in localStorage. Storage can be missing or
 * blocked (private mode), so every read and write may fail and falls back to the default.
 */

const THEME_KEY = 'yahtzee.theme';
const MUTED_KEY = 'yahtzee.muted';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered, but the setting still works until the page is closed.
  }
}

function useStored<T>(key: string, parse: (raw: string | null) => T, format: (value: T) => string) {
  const [value, setValue] = useState<T>(() => parse(read(key)));
  const update = useCallback(
    (next: T) => {
      setValue(next);
      write(key, format(next));
    },
    [key, format],
  );
  return [value, update] as const;
}

const parseTheme = (raw: string | null): ThemeId => (isTheme(raw) ? raw : DEFAULT_THEME);
const parseMuted = (raw: string | null): boolean => raw === '1';
const formatMuted = (muted: boolean) => (muted ? '1' : '0');
const same = (value: string) => value;

/** The theme for the next game on this laptop. */
export function useThemePreference() {
  return useStored<ThemeId>(THEME_KEY, parseTheme, same);
}

/** Whether this device plays sounds. Every device has its own mute button. */
export function useMuted() {
  return useStored<boolean>(MUTED_KEY, parseMuted, formatMuted);
}

const JOIN_KEY = 'yahtzee.joinAddress';
const parseText = (raw: string | null): string => raw ?? '';

/**
 * The laptop address the QR code shows, when someone picked one by hand (a laptop with
 * Wi-Fi, a cable and a VPN has several). Empty: use the best one the server found.
 */
export function useJoinChoice() {
  return useStored<string>(JOIN_KEY, parseText, same);
}
