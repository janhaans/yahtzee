import {
  emptyScorecard,
  type BoxId,
  type Dice,
  type DieValue,
  type Player,
  type Rng,
  type Scorecard,
} from '../src/index.js';

export function dice(...values: number[]): Dice {
  if (values.length !== 5) throw new Error('need exactly 5 dice');
  return values as unknown as Dice;
}

export function card(
  filled: Partial<Record<BoxId, number>> = {},
  yahtzeeBonusCount = 0,
): Scorecard {
  return { boxes: { ...emptyScorecard().boxes, ...filled }, yahtzeeBonusCount };
}

/** Rng that makes rollDie return the given faces, in order. */
export function fixedRng(...faces: DieValue[]): Rng {
  let i = 0;
  return () => {
    const face = faces[i++ % faces.length] as DieValue;
    return (face - 1) / 6 + 0.01;
  };
}

export function player(id: string, name = id): Player {
  return { id, name, avatar: 'cupcake', colour: '#ff69b4', type: 'human' };
}
