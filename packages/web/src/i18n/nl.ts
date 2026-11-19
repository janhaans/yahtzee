import type { BoxId } from '@yahtzee/game-logic';

/** All Dutch user-facing text. More sections are added per milestone. */
export const nl = {
  boxes: {
    ones: 'Enen',
    twos: 'Tweeën',
    threes: 'Drieën',
    fours: 'Vieren',
    fives: 'Vijven',
    sixes: 'Zessen',
    threeOfAKind: 'Drie gelijke',
    fourOfAKind: 'Vier gelijke',
    fullHouse: 'Full House',
    smallStraight: 'Kleine straat',
    largeStraight: 'Grote straat',
    yahtzee: 'Yahtzee',
    chance: 'Kans',
  } satisfies Record<BoxId, string>,
} as const;
