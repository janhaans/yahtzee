import type { ThemeId } from '@yahtzee/server/looks';
import { nl } from '../i18n/nl';
import type { GameEvent } from './events';

/** Kinds of funny message, from best to plainest. */
export const MESSAGE_KINDS = [
  'yahtzee',
  'yahtzeeBonus',
  'bonus',
  'largeStraight',
  'smallStraight',
  'fullHouse',
  'high',
  'good',
  'zero',
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** Points that feel like a big score in boxes that add up the dice. */
const HIGH_POINTS = 24;

type Scored = Extract<GameEvent, { kind: 'scored' }>;

/** Which kind of message fits a scored box. The most special thing wins. */
export function messageKind(event: Scored): MessageKind {
  if (event.yahtzeeBonus) return 'yahtzeeBonus';
  if (event.box === 'yahtzee' && event.points > 0) return 'yahtzee';
  if (event.upperBonus) return 'bonus';
  if (event.points === 0) return 'zero';
  if (event.box === 'largeStraight') return 'largeStraight';
  if (event.box === 'smallStraight') return 'smallStraight';
  if (event.box === 'fullHouse') return 'fullHouse';
  return event.points >= HIGH_POINTS ? 'high' : 'good';
}

/** How many recent messages are not picked again. */
const MEMORY = 6;

/**
 * Picks a random message of a kind for a theme, avoiding the ones shown recently so the
 * same joke does not come back every turn.
 */
export class MessagePicker {
  readonly #recent: string[] = [];

  constructor(private readonly random: () => number = Math.random) {}

  pick(theme: ThemeId, kind: MessageKind): string {
    const all: readonly string[] = nl.messages[theme][kind];
    const fresh = all.filter((message) => !this.#recent.includes(message));
    const choices = fresh.length > 0 ? fresh : all;
    const message = choices[Math.floor(this.random() * choices.length)]!;
    this.#recent.push(message);
    if (this.#recent.length > MEMORY) this.#recent.shift();
    return message;
  }
}
