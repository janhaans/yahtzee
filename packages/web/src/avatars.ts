import { isAvatar, type AvatarId } from '@yahtzee/server/looks';

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

export { defaultAvatar, freeColour } from '@yahtzee/server/looks';
