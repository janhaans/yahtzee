/** Emoji for each avatar id the server hands out. Proper avatar choice follows in milestone 4. */
const AVATAR_EMOJI: Record<string, string> = {
  cupcake: '🧁',
  football: '⚽',
  lollipop: '🍭',
  trophy: '🏆',
};

export function avatarEmoji(avatar: string): string {
  return AVATAR_EMOJI[avatar] ?? '🙂';
}
