export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

/** Always exactly five dice. */
export type Dice = readonly [DieValue, DieValue, DieValue, DieValue, DieValue];

/** Which of the five dice are held (not re-rolled). */
export type Held = readonly [boolean, boolean, boolean, boolean, boolean];

export const UPPER_BOXES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const;

export const LOWER_BOXES = [
  'threeOfAKind',
  'fourOfAKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
] as const;

export const BOX_IDS = [...UPPER_BOXES, ...LOWER_BOXES] as const;

export type UpperBoxId = (typeof UPPER_BOXES)[number];
export type LowerBoxId = (typeof LOWER_BOXES)[number];
export type BoxId = UpperBoxId | LowerBoxId;

export interface Scorecard {
  /** Points per box; null means the box is still empty. */
  readonly boxes: Readonly<Record<BoxId, number | null>>;
  /** Number of extra Yahtzees that earned the 100-point bonus. */
  readonly yahtzeeBonusCount: number;
}

export interface Totals {
  readonly upperTotal: number;
  readonly upperBonus: number;
  readonly lowerTotal: number;
  readonly yahtzeeBonus: number;
  readonly grandTotal: number;
}

export type PlayerType = 'human' | 'computer';

export interface Player {
  readonly id: string;
  readonly name: string;
  readonly avatar: string;
  readonly colour: string;
  readonly type: PlayerType;
}

/** Returns a number in [0, 1), like Math.random. Injected so the server owns the dice. */
export type Rng = () => number;
