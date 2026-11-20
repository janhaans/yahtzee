import type { ThemeId } from '@yahtzee/server/looks';

/** How a set of dice looks. Kept as data, so dice skins can be offered later. */
export interface DiceLook {
  /** Face colour. */
  readonly face: string;
  /** Pip colour: always strongly contrasting with the face, so the numbers stay clear. */
  readonly pip: string;
  /** Edge and outline colour. */
  readonly edge: string;
  /** Extra decoration on each face, drawn in CSS (cubes) and on a canvas (3D dice). */
  readonly pattern: 'none' | 'football' | 'sugar';
  /** Colour of the decoration. */
  readonly patternColour: string;
  /** Corner rounding, as a share of the die size (0 to 0.5). */
  readonly rounding: number;
}

/** All dice looks. The themes use the plain ones; the others can return as dice skins. */
export const DICE_SKINS = {
  plain: {
    face: '#ffffff',
    pip: '#1f2430',
    edge: '#eceef1',
    pattern: 'none',
    patternColour: '#ffffff',
    rounding: 0.24,
  },
  plainCandy: {
    face: '#ffffff',
    pip: '#c2255c',
    edge: '#eceef1',
    pattern: 'none',
    patternColour: '#ffffff',
    rounding: 0.24,
  },
  // White footballs with grey patches in the corners.
  football: {
    face: '#ffffff',
    pip: '#111111',
    edge: '#2b2b2b',
    pattern: 'football',
    patternColour: '#d9d9d9',
    rounding: 0.18,
  },
  // Sugar cubes with sparkly crystals and raspberry-red pips.
  sugar: {
    face: '#fffaf3',
    pip: '#a61e4d',
    edge: '#e8c9b5',
    pattern: 'sugar',
    patternColour: '#f1e3d3',
    rounding: 0.24,
  },
} as const satisfies Record<string, DiceLook>;

/**
 * Everything a theme changes, as data. Colours and the subtle table details live in
 * styles/themes.css under `[data-theme='…']`; the rest is here.
 */
export interface Theme {
  readonly id: ThemeId;
  readonly dice: DiceLook;
}

export const THEMES: Record<ThemeId, Theme> = {
  voetbal: { id: 'voetbal', dice: DICE_SKINS.plain },
  snoep: { id: 'snoep', dice: DICE_SKINS.plainCandy },
};
