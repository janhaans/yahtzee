import { COLOURS, isAvatar, type AvatarId, type Colour, type ThemeId } from '@yahtzee/server/looks';

const AVATAR_EMOJI: Record<AvatarId, string> = {
  football: '⚽',
  glove: '🧤',
  trophy: '🏆',
  shirt: '👕',
  cupcake: '🧁',
  lollipop: '🍭',
  donut: '🍩',
  icecream: '🍦',
  gummybear: '🧸',
  cat: '🐱',
  dog: '🐶',
  unicorn: '🦄',
  panda: '🐼',
  fox: '🦊',
};

export function avatarEmoji(avatar: string): string {
  return isAvatar(avatar) ? AVATAR_EMOJI[avatar] : '🙂';
}

/** The avatars each new player starts with, so the first players match the theme. */
const THEME_AVATARS: Record<ThemeId, readonly AvatarId[]> = {
  voetbal: ['football', 'glove', 'trophy', 'shirt'],
  snoep: ['cupcake', 'lollipop', 'donut', 'icecream'],
};

export function defaultAvatar(theme: ThemeId, seat: number): AvatarId {
  const avatars = THEME_AVATARS[theme];
  return avatars[seat % avatars.length]!;
}

/** The first colour nobody has picked yet. */
export function freeColour(taken: readonly string[]): Colour {
  return COLOURS.find((colour) => !taken.includes(colour)) ?? COLOURS[0];
}
