import { describe, expect, it } from 'vitest';
import {
  BOX_IDS,
  LOWER_BOXES,
  UPPER_BOXES,
  allowedBoxes,
  applyScore,
  earnsYahtzeeBonus,
  emptyScorecard,
  isComplete,
  isYahtzee,
  jokerApplies,
  previewScores,
  scoreBox,
  totals,
  type BoxId,
} from '../src/index.js';
import { card, dice } from './helpers.js';

const empty = emptyScorecard();

describe('emptyScorecard', () => {
  it('has all 13 boxes empty and no bonus', () => {
    expect(Object.keys(empty.boxes)).toHaveLength(13);
    expect(BOX_IDS.every((box) => empty.boxes[box] === null)).toBe(true);
    expect(empty.yahtzeeBonusCount).toBe(0);
  });
});

describe('upper boxes', () => {
  it.each([
    ['ones', dice(1, 1, 2, 3, 1), 3],
    ['twos', dice(2, 2, 2, 2, 5), 8],
    ['threes', dice(3, 1, 2, 4, 5), 3],
    ['fours', dice(4, 4, 4, 4, 4), 20],
    ['fives', dice(5, 5, 1, 2, 3), 10],
    ['sixes', dice(6, 6, 6, 1, 2), 18],
  ] as const)('%s scores the sum of matching dice', (box, d, expected) => {
    expect(scoreBox(box, d, empty)).toBe(expected);
  });

  it.each(UPPER_BOXES.slice(1))('%s scores 0 without matching dice', (box) => {
    expect(scoreBox(box, dice(1, 1, 1, 1, 1), empty)).toBe(0);
  });

  it('ones scores 0 without ones', () => {
    expect(scoreBox('ones', dice(2, 3, 4, 5, 6), empty)).toBe(0);
  });
});

describe('three of a kind', () => {
  it('scores the sum of all dice with three the same', () => {
    expect(scoreBox('threeOfAKind', dice(3, 3, 3, 5, 6), empty)).toBe(20);
  });
  it('also counts four the same', () => {
    expect(scoreBox('threeOfAKind', dice(2, 2, 2, 2, 6), empty)).toBe(14);
  });
  it('also counts a Yahtzee', () => {
    expect(scoreBox('threeOfAKind', dice(5, 5, 5, 5, 5), empty)).toBe(25);
  });
  it('also counts a full house', () => {
    expect(scoreBox('threeOfAKind', dice(4, 4, 4, 1, 1), empty)).toBe(14);
  });
  it('scores 0 with only two the same', () => {
    expect(scoreBox('threeOfAKind', dice(3, 3, 2, 2, 6), empty)).toBe(0);
  });
});

describe('four of a kind', () => {
  it('scores the sum of all dice with four the same', () => {
    expect(scoreBox('fourOfAKind', dice(6, 6, 6, 6, 1), empty)).toBe(25);
  });
  it('also counts a Yahtzee', () => {
    expect(scoreBox('fourOfAKind', dice(1, 1, 1, 1, 1), empty)).toBe(5);
  });
  it('scores 0 with only three the same', () => {
    expect(scoreBox('fourOfAKind', dice(6, 6, 6, 1, 2), empty)).toBe(0);
  });
});

describe('full house', () => {
  it('scores 25 for three of one and two of another', () => {
    expect(scoreBox('fullHouse', dice(2, 3, 2, 3, 2), empty)).toBe(25);
  });
  it('scores 0 for four of a kind', () => {
    expect(scoreBox('fullHouse', dice(2, 2, 2, 2, 3), empty)).toBe(0);
  });
  it('scores 0 for three of a kind plus two different dice', () => {
    expect(scoreBox('fullHouse', dice(2, 2, 2, 3, 4), empty)).toBe(0);
  });
  it('scores 0 for two pairs', () => {
    expect(scoreBox('fullHouse', dice(2, 2, 3, 3, 4), empty)).toBe(0);
  });
  it('scores 0 for a Yahtzee without the Joker rule', () => {
    expect(scoreBox('fullHouse', dice(4, 4, 4, 4, 4), empty)).toBe(0);
  });
});

describe('small straight', () => {
  it.each([
    [dice(1, 2, 3, 4, 6)],
    [dice(2, 3, 4, 5, 5)],
    [dice(6, 5, 4, 3, 1)],
    [dice(3, 4, 3, 5, 6)],
    [dice(1, 2, 3, 4, 5)],
  ])('scores 30 for %j', (d) => {
    expect(scoreBox('smallStraight', d, empty)).toBe(30);
  });
  it.each([[dice(1, 2, 3, 5, 6)], [dice(1, 1, 2, 2, 3)], [dice(6, 6, 6, 6, 6)]])(
    'scores 0 for %j',
    (d) => {
      expect(scoreBox('smallStraight', d, empty)).toBe(0);
    },
  );
});

describe('large straight', () => {
  it.each([[dice(1, 2, 3, 4, 5)], [dice(6, 2, 5, 3, 4)]])('scores 40 for %j', (d) => {
    expect(scoreBox('largeStraight', d, empty)).toBe(40);
  });
  it.each([[dice(1, 2, 3, 4, 6)], [dice(1, 2, 3, 4, 4)], [dice(3, 3, 3, 3, 3)]])(
    'scores 0 for %j',
    (d) => {
      expect(scoreBox('largeStraight', d, empty)).toBe(0);
    },
  );
});

describe('yahtzee', () => {
  it('scores 50 for five the same', () => {
    expect(scoreBox('yahtzee', dice(6, 6, 6, 6, 6), empty)).toBe(50);
  });
  it('scores 0 for four the same', () => {
    expect(scoreBox('yahtzee', dice(6, 6, 6, 6, 5), empty)).toBe(0);
  });
  it('isYahtzee detects five the same', () => {
    expect(isYahtzee(dice(2, 2, 2, 2, 2))).toBe(true);
    expect(isYahtzee(dice(2, 2, 2, 2, 1))).toBe(false);
  });
});

describe('chance', () => {
  it('scores the sum of all dice', () => {
    expect(scoreBox('chance', dice(1, 3, 5, 6, 2), empty)).toBe(17);
    expect(scoreBox('chance', dice(6, 6, 6, 6, 6), empty)).toBe(30);
  });
});

describe('allowedBoxes without a Joker', () => {
  it('allows every box on an empty scorecard', () => {
    expect(allowedBoxes(dice(1, 2, 3, 4, 6), empty)).toEqual([...BOX_IDS]);
  });

  it('allows only empty boxes, including ones that score 0 (scratch)', () => {
    const sc = card({ ones: 3, chance: 20 });
    const allowed = allowedBoxes(dice(2, 2, 3, 5, 6), sc);
    expect(allowed).not.toContain('ones');
    expect(allowed).not.toContain('chance');
    expect(allowed).toContain('yahtzee');
    expect(allowed).toHaveLength(11);
  });

  it('allows any empty box for a first Yahtzee', () => {
    expect(allowedBoxes(dice(3, 3, 3, 3, 3), empty)).toEqual([...BOX_IDS]);
  });
});

describe('Joker rule and Yahtzee bonus', () => {
  const yahtzee50 = card({ yahtzee: 50 });
  const yahtzee0 = card({ yahtzee: 0 });
  const fives = dice(5, 5, 5, 5, 5);

  it('applies only to a Yahtzee with a filled Yahtzee box', () => {
    expect(jokerApplies(fives, empty)).toBe(false);
    expect(jokerApplies(dice(5, 5, 5, 5, 4), yahtzee50)).toBe(false);
    expect(jokerApplies(fives, yahtzee50)).toBe(true);
    expect(jokerApplies(fives, yahtzee0)).toBe(true);
  });

  it('earns the bonus only when the Yahtzee box holds 50', () => {
    expect(earnsYahtzeeBonus(fives, yahtzee50)).toBe(true);
    expect(earnsYahtzeeBonus(fives, yahtzee0)).toBe(false);
    expect(earnsYahtzeeBonus(fives, empty)).toBe(false);
    expect(earnsYahtzeeBonus(dice(5, 5, 5, 5, 4), yahtzee50)).toBe(false);
  });

  it('forces the matching upper box when it is empty', () => {
    expect(allowedBoxes(fives, yahtzee50)).toEqual(['fives']);
    expect(allowedBoxes(fives, yahtzee0)).toEqual(['fives']);
    expect(previewScores(fives, yahtzee50)).toEqual({ fives: 25 });
  });

  it('allows any empty lower box when the matching upper box is filled', () => {
    const sc = card({ yahtzee: 50, fives: 15, chance: 22 });
    expect(allowedBoxes(fives, sc)).toEqual([
      'threeOfAKind',
      'fourOfAKind',
      'fullHouse',
      'smallStraight',
      'largeStraight',
    ]);
  });

  it('gives Full House, Small and Large Straight their full value as Joker', () => {
    const sc = card({ yahtzee: 50, fives: 15 });
    expect(previewScores(fives, sc)).toEqual({
      threeOfAKind: 25,
      fourOfAKind: 25,
      fullHouse: 25,
      smallStraight: 30,
      largeStraight: 40,
      chance: 25,
    });
  });

  it('also gives Joker values when the Yahtzee box holds 0', () => {
    const sc = card({ yahtzee: 0, twos: 6 });
    const twos = dice(2, 2, 2, 2, 2);
    expect(scoreBox('fullHouse', twos, sc)).toBe(25);
    expect(scoreBox('smallStraight', twos, sc)).toBe(30);
    expect(scoreBox('largeStraight', twos, sc)).toBe(40);
  });

  it('forces a 0 in an empty upper box when all lower boxes are filled', () => {
    const lowerFull = Object.fromEntries(LOWER_BOXES.map((box) => [box, 10])) as Record<
      BoxId,
      number
    >;
    const sc = card({ ...lowerFull, yahtzee: 50, fives: 20, ones: 2 });
    expect(allowedBoxes(fives, sc)).toEqual(['twos', 'threes', 'fours', 'sixes']);
    expect(previewScores(fives, sc)).toEqual({ twos: 0, threes: 0, fours: 0, sixes: 0 });
  });

  it('applyScore adds the bonus for an extra Yahtzee with 50 in the box', () => {
    const after = applyScore(yahtzee50, 'fives', fives);
    expect(after.boxes.fives).toBe(25);
    expect(after.yahtzeeBonusCount).toBe(1);

    const again = applyScore(card({ yahtzee: 50, fives: 25 }, 1), 'largeStraight', fives);
    expect(again.boxes.largeStraight).toBe(40);
    expect(again.yahtzeeBonusCount).toBe(2);
    expect(totals(again).yahtzeeBonus).toBe(200);
  });

  it('applyScore adds no bonus when the Yahtzee box holds 0', () => {
    const after = applyScore(yahtzee0, 'fives', fives);
    expect(after.boxes.fives).toBe(25);
    expect(after.yahtzeeBonusCount).toBe(0);
  });

  it('applyScore adds no bonus for the first Yahtzee', () => {
    const after = applyScore(empty, 'yahtzee', fives);
    expect(after.boxes.yahtzee).toBe(50);
    expect(after.yahtzeeBonusCount).toBe(0);
  });

  it('applyScore does not change the original scorecard', () => {
    applyScore(yahtzee50, 'fives', fives);
    expect(yahtzee50.boxes.fives).toBeNull();
    expect(yahtzee50.yahtzeeBonusCount).toBe(0);
  });
});

describe('previewScores', () => {
  it('shows points for every empty box', () => {
    const sc = card({ chance: 12 });
    expect(previewScores(dice(3, 3, 3, 2, 2), sc)).toEqual({
      ones: 0,
      twos: 4,
      threes: 9,
      fours: 0,
      fives: 0,
      sixes: 0,
      threeOfAKind: 13,
      fourOfAKind: 0,
      fullHouse: 25,
      smallStraight: 0,
      largeStraight: 0,
      yahtzee: 0,
    });
  });
});

describe('totals', () => {
  it('is all zero for an empty scorecard', () => {
    expect(totals(empty)).toEqual({
      upperTotal: 0,
      upperBonus: 0,
      lowerTotal: 0,
      yahtzeeBonus: 0,
      grandTotal: 0,
    });
  });

  it('gives no upper bonus at 62', () => {
    const sc = card({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 17 });
    expect(totals(sc).upperTotal).toBe(62);
    expect(totals(sc).upperBonus).toBe(0);
  });

  it('gives the 35 upper bonus at exactly 63', () => {
    const sc = card({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 });
    expect(totals(sc).upperTotal).toBe(63);
    expect(totals(sc).upperBonus).toBe(35);
  });

  it('gives 35 (not more) above 63', () => {
    const sc = card({ ones: 5, twos: 10, threes: 15, fours: 20, fives: 25, sixes: 30 });
    expect(totals(sc).upperTotal).toBe(105);
    expect(totals(sc).upperBonus).toBe(35);
  });

  it('adds up a full scorecard', () => {
    const sc = card(
      {
        ones: 3,
        twos: 6,
        threes: 9,
        fours: 12,
        fives: 15,
        sixes: 18,
        threeOfAKind: 20,
        fourOfAKind: 25,
        fullHouse: 25,
        smallStraight: 30,
        largeStraight: 40,
        yahtzee: 50,
        chance: 22,
      },
      2,
    );
    expect(totals(sc)).toEqual({
      upperTotal: 63,
      upperBonus: 35,
      lowerTotal: 212,
      yahtzeeBonus: 200,
      grandTotal: 510,
    });
  });

  it('counts empty boxes as 0 (aborted game)', () => {
    expect(totals(card({ sixes: 24, chance: 18 })).grandTotal).toBe(42);
  });
});

describe('isComplete', () => {
  it('is false while a box is empty and true when all are filled', () => {
    const all = Object.fromEntries(BOX_IDS.map((box) => [box, 0])) as Record<BoxId, number>;
    expect(isComplete(empty)).toBe(false);
    expect(isComplete(card(all))).toBe(true);
    expect(isComplete({ ...card(all), boxes: { ...all, chance: null } })).toBe(false);
  });
});
