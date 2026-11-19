import {
  FULL_HOUSE_SCORE,
  LARGE_STRAIGHT_SCORE,
  SMALL_STRAIGHT_SCORE,
  UPPER_BONUS,
  UPPER_BONUS_THRESHOLD,
  YAHTZEE_BONUS,
  YAHTZEE_SCORE,
} from './constants.js';
import {
  BOX_IDS,
  LOWER_BOXES,
  UPPER_BOXES,
  type BoxId,
  type Dice,
  type DieValue,
  type Scorecard,
  type Totals,
  type UpperBoxId,
} from './types.js';

const UPPER_BOX_FACE: Readonly<Record<UpperBoxId, DieValue>> = {
  ones: 1,
  twos: 2,
  threes: 3,
  fours: 4,
  fives: 5,
  sixes: 6,
};

const FACE_UPPER_BOX: Readonly<Record<DieValue, UpperBoxId>> = {
  1: 'ones',
  2: 'twos',
  3: 'threes',
  4: 'fours',
  5: 'fives',
  6: 'sixes',
};

export function emptyScorecard(): Scorecard {
  const boxes = Object.fromEntries(BOX_IDS.map((box) => [box, null])) as Record<BoxId, null>;
  return { boxes, yahtzeeBonusCount: 0 };
}

function sum(dice: Dice): number {
  return dice.reduce<number>((total, die) => total + die, 0);
}

/** How many dice show each face, sorted from most to least. */
function groupSizes(dice: Dice): number[] {
  const counts = new Map<DieValue, number>();
  for (const die of dice) counts.set(die, (counts.get(die) ?? 0) + 1);
  return [...counts.values()].sort((a, b) => b - a);
}

function longestRun(dice: Dice): number {
  const faces = new Set(dice);
  let longest = 0;
  let run = 0;
  for (let face = 1; face <= 6; face++) {
    run = faces.has(face as DieValue) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

export function isYahtzee(dice: Dice): boolean {
  return dice.every((die) => die === dice[0]);
}

/** Score for a box by the normal rules, ignoring the Joker rule. */
function baseScore(box: BoxId, dice: Dice): number {
  const [largestGroup = 0, secondGroup = 0] = groupSizes(dice);
  switch (box) {
    case 'ones':
    case 'twos':
    case 'threes':
    case 'fours':
    case 'fives':
    case 'sixes': {
      const face = UPPER_BOX_FACE[box];
      return dice.filter((die) => die === face).length * face;
    }
    case 'threeOfAKind':
      return largestGroup >= 3 ? sum(dice) : 0;
    case 'fourOfAKind':
      return largestGroup >= 4 ? sum(dice) : 0;
    case 'fullHouse':
      return largestGroup === 3 && secondGroup === 2 ? FULL_HOUSE_SCORE : 0;
    case 'smallStraight':
      return longestRun(dice) >= 4 ? SMALL_STRAIGHT_SCORE : 0;
    case 'largeStraight':
      return longestRun(dice) === 5 ? LARGE_STRAIGHT_SCORE : 0;
    case 'yahtzee':
      return largestGroup === 5 ? YAHTZEE_SCORE : 0;
    case 'chance':
      return sum(dice);
  }
}

/**
 * The Joker rule applies to an extra Yahtzee: the dice are a Yahtzee and the
 * Yahtzee box is already filled (with 50 or with 0).
 */
export function jokerApplies(dice: Dice, scorecard: Scorecard): boolean {
  return isYahtzee(dice) && scorecard.boxes.yahtzee !== null;
}

/** True when this roll earns the +100 Yahtzee bonus. */
export function earnsYahtzeeBonus(dice: Dice, scorecard: Scorecard): boolean {
  return isYahtzee(dice) && scorecard.boxes.yahtzee === YAHTZEE_SCORE;
}

/**
 * Boxes the player may choose for these dice. Normally every empty box.
 * With the Joker rule (official rules): the matching upper box if it is empty;
 * otherwise any empty lower box; otherwise any empty upper box (scoring 0).
 */
export function allowedBoxes(dice: Dice, scorecard: Scorecard): BoxId[] {
  const isEmpty = (box: BoxId) => scorecard.boxes[box] === null;
  if (!jokerApplies(dice, scorecard)) return BOX_IDS.filter(isEmpty);

  const matchingUpper = FACE_UPPER_BOX[dice[0]];
  if (isEmpty(matchingUpper)) return [matchingUpper];

  const emptyLower = LOWER_BOXES.filter(isEmpty);
  if (emptyLower.length > 0) return emptyLower;

  return UPPER_BOXES.filter(isEmpty);
}

/** Points a box would get for these dice, including the Joker rule. */
export function scoreBox(box: BoxId, dice: Dice, scorecard: Scorecard): number {
  if (jokerApplies(dice, scorecard)) {
    if (box === 'fullHouse') return FULL_HOUSE_SCORE;
    if (box === 'smallStraight') return SMALL_STRAIGHT_SCORE;
    if (box === 'largeStraight') return LARGE_STRAIGHT_SCORE;
  }
  return baseScore(box, dice);
}

/** Point preview for every box the player may choose right now. */
export function previewScores(dice: Dice, scorecard: Scorecard): Partial<Record<BoxId, number>> {
  return Object.fromEntries(
    allowedBoxes(dice, scorecard).map((box) => [box, scoreBox(box, dice, scorecard)]),
  );
}

/**
 * Writes the score for a box and adds the Yahtzee bonus if earned.
 * Assumes the box is in allowedBoxes(); the game module checks that.
 */
export function applyScore(scorecard: Scorecard, box: BoxId, dice: Dice): Scorecard {
  return {
    boxes: { ...scorecard.boxes, [box]: scoreBox(box, dice, scorecard) },
    yahtzeeBonusCount: scorecard.yahtzeeBonusCount + (earnsYahtzeeBonus(dice, scorecard) ? 1 : 0),
  };
}

export function isComplete(scorecard: Scorecard): boolean {
  return BOX_IDS.every((box) => scorecard.boxes[box] !== null);
}

export function totals(scorecard: Scorecard): Totals {
  const add = (boxes: readonly BoxId[]) =>
    boxes.reduce((total, box) => total + (scorecard.boxes[box] ?? 0), 0);
  const upperTotal = add(UPPER_BOXES);
  const upperBonus = upperTotal >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
  const lowerTotal = add(LOWER_BOXES);
  const yahtzeeBonus = scorecard.yahtzeeBonusCount * YAHTZEE_BONUS;
  return {
    upperTotal,
    upperBonus,
    lowerTotal,
    yahtzeeBonus,
    grandTotal: upperTotal + upperBonus + lowerTotal + yahtzeeBonus,
  };
}
