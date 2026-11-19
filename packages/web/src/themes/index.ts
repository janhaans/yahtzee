import type { ThemeId } from '@yahtzee/server/looks';

/**
 * Everything a theme changes, as data. The colours and backgrounds live in themes.css under
 * `[data-theme='…']`; dice looks, sounds, messages and celebrations are added here.
 */
export interface Theme {
  readonly id: ThemeId;
  /** Shown on the theme card on the start screen. */
  readonly emoji: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  voetbal: { id: 'voetbal', emoji: '⚽🏟️' },
  snoep: { id: 'snoep', emoji: '🍭🍬' },
};
