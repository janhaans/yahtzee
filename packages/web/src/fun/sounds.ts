import type { GameEvent } from './events';

/**
 * The sounds of the game. Each theme plays its own version of every sound (see the sound
 * engine); this list is what the game asks for.
 */
export type SoundName = 'roll' | 'hold' | 'score' | 'zero' | 'bonus' | 'turn' | 'yahtzee' | 'win';

/** The sounds that go with an event. */
export function soundsFor(event: GameEvent): SoundName[] {
  switch (event.kind) {
    case 'turn':
      return ['turn'];
    case 'held':
      return ['hold'];
    case 'rolled':
      // The dice make their own rolling sound, in time with how they move.
      return event.yahtzee ? ['yahtzee'] : [];
    case 'scored':
      if (event.upperBonus || event.yahtzeeBonus) return ['bonus'];
      return event.points === 0 ? ['zero'] : ['score'];
    case 'gameOver':
      return ['win'];
    case 'newGame':
      return [];
  }
}
