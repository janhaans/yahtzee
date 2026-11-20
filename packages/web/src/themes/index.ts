import type { ThemeId } from '@yahtzee/server/looks';

/** How the dice of a theme look. Kept as data, so extra dice skins can be added later. */
export interface DiceLook {
  /** Face colour. */
  readonly face: string;
  /** Pip colour: always strongly contrasting with the face, so the numbers stay clear. */
  readonly pip: string;
  /** Edge and outline colour. */
  readonly edge: string;
  /** Extra decoration on each face, drawn in CSS (cubes) and on a canvas (3D dice). */
  readonly pattern: 'football' | 'sugar';
  /** Colour of the decoration. */
  readonly patternColour: string;
  /** Corner rounding, as a share of the die size (0 to 0.5). */
  readonly rounding: number;
}

/**
 * Everything a theme changes, as data. The colours and backgrounds live in themes.css under
 * `[data-theme='…']`; the rest is here.
 */
export interface Theme {
  readonly id: ThemeId;
  /** Shown on the theme card on the start screen. */
  readonly emoji: string;
  readonly dice: DiceLook;
}

export const THEMES: Record<ThemeId, Theme> = {
  voetbal: {
    id: 'voetbal',
    emoji: '⚽🏟️',
    // White footballs with black patches in the corners.
    dice: {
      face: '#ffffff',
      pip: '#111111',
      edge: '#2b2b2b',
      pattern: 'football',
      patternColour: '#d9d9d9',
      rounding: 0.18,
    },
  },
  snoep: {
    id: 'snoep',
    emoji: '🍭🍬',
    // Sugar cubes with sparkly crystals and raspberry-red pips.
    dice: {
      face: '#fffaf3',
      pip: '#a61e4d',
      edge: '#e8c9b5',
      pattern: 'sugar',
      patternColour: '#f1e3d3',
      rounding: 0.24,
    },
  },
};
