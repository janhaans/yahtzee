/**
 * The avatars, colours and themes a game can use. Shared with the web app, so the server
 * can check what a client sends and the pickers only offer valid choices.
 */

export const THEMES = ['voetbal', 'snoep'] as const;
export type ThemeId = (typeof THEMES)[number];
export const DEFAULT_THEME: ThemeId = 'voetbal';

export const AVATARS = [
  // Soccer
  'football',
  'glove',
  'trophy',
  'shirt',
  // Sweets
  'cupcake',
  'lollipop',
  'donut',
  'icecream',
  'gummybear',
  // Animals
  'cat',
  'dog',
  'unicorn',
  'panda',
  'fox',
] as const;
export type AvatarId = (typeof AVATARS)[number];

/** Player colours. All are dark enough for white text on top. */
export const COLOURS = [
  '#e8457c',
  '#2e8b57',
  '#7b4fd6',
  '#d66a00',
  '#1f6fd1',
  '#c62828',
  '#00838f',
  '#8d5a2b',
] as const;
export type Colour = (typeof COLOURS)[number];

export function isTheme(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

export function isAvatar(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATARS as readonly string[]).includes(value);
}

export function isColour(value: unknown): value is Colour {
  return typeof value === 'string' && (COLOURS as readonly string[]).includes(value);
}

/** A player as the setup screen sends them; the server adds the id and type. */
export interface NewPlayer {
  readonly name: string;
  readonly avatar: AvatarId;
  readonly colour: Colour;
}

/** Everything needed to start a game. */
export interface GameSetup {
  readonly players: readonly NewPlayer[];
  readonly theme: ThemeId;
}
