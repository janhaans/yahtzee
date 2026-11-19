import { describe, expect, it } from 'vitest';
import {
  BOX_IDS,
  abortGame,
  chooseBox,
  createGame,
  nameKey,
  roll,
  scores,
  toggleHold,
  winners,
  type GameState,
  type MoveError,
  type Result,
} from '../src/index.js';
import { card, dice, fixedRng, player } from './helpers.js';

function unwrap<E>(result: Result<E>): GameState {
  if (!result.ok) throw new Error(`expected ok, got ${String(result.error)}`);
  return result.state;
}

function errorOf<E>(result: Result<E>): E | undefined {
  return result.ok ? undefined : result.error;
}

function newGame(count = 2): GameState {
  return unwrap(createGame(['a', 'b', 'c', 'd'].slice(0, count).map((id) => player(id))));
}

describe('createGame', () => {
  it.each([2, 3, 4])('starts a game with %i players', (count) => {
    const state = newGame(count);
    expect(state.players).toHaveLength(count);
    expect(state.scorecards).toHaveLength(count);
    expect(state).toMatchObject({
      currentPlayerIndex: 0,
      round: 1,
      dice: null,
      held: [false, false, false, false, false],
      rollsUsed: 0,
      status: 'in_progress',
    });
  });

  it('rejects 0, 1 and 5 players', () => {
    expect(errorOf(createGame([]))).toBe('too_few_players');
    expect(errorOf(createGame([player('a')]))).toBe('too_few_players');
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => player(id));
    expect(errorOf(createGame(five))).toBe('too_many_players');
  });

  it('rejects duplicate player ids', () => {
    expect(errorOf(createGame([player('a', 'Emma'), player('a', 'Sara')]))).toBe(
      'duplicate_player_id',
    );
  });

  it('rejects empty or blank names', () => {
    expect(errorOf(createGame([player('a', ''), player('b')]))).toBe('name_required');
    expect(errorOf(createGame([player('a'), player('b', '   ')]))).toBe('name_required');
  });

  it('allows names up to 15 characters', () => {
    const name = 'Anne-Marijke Jo';
    expect(name).toHaveLength(15);
    expect(createGame([player('a', name), player('b')]).ok).toBe(true);
    expect(errorOf(createGame([player('a', `${name}x`), player('b')]))).toBe('name_too_long');
  });

  it('rejects duplicate names, ignoring case and spaces', () => {
    expect(errorOf(createGame([player('a', 'Emma'), player('b', ' emma ')]))).toBe(
      'duplicate_name',
    );
    expect(errorOf(createGame([player('a', 'Anna  Sophie'), player('b', 'ANNA SOPHIE')]))).toBe(
      'duplicate_name',
    );
  });

  it('collapses extra spaces inside names', () => {
    const state = unwrap(createGame([player('a', ' Anna \t  Sophie '), player('b', 'Sara')]));
    expect(state.players[0]?.name).toBe('Anna Sophie');
  });

  it('trims names and keeps the player type', () => {
    const state = unwrap(createGame([player('a', '  Emma '), player('b', 'Sara')]));
    expect(state.players.map((p) => p.name)).toEqual(['Emma', 'Sara']);
    expect(state.players[0]?.type).toBe('human');
  });

  it('accepts a computer player', () => {
    const computer = { ...player('c', 'Computer'), type: 'computer' as const };
    const state = unwrap(createGame([player('a', 'Emma'), computer]));
    expect(state.players[1]?.type).toBe('computer');
  });
});

describe('nameKey', () => {
  it('ignores upper/lower case and extra spaces, like the setup check', () => {
    expect(nameKey('  Anna   SOPHIE ')).toBe('anna sophie');
    expect(nameKey('Anna Sophie')).toBe(nameKey('anna\tsophie'));
    expect(nameKey('Emma')).not.toBe(nameKey('Emmy'));
  });
});

describe('roll', () => {
  it('rolls five dice using the injected rng', () => {
    const state = unwrap(roll(newGame(), fixedRng(1, 2, 3, 4, 5)));
    expect(state.dice).toEqual([1, 2, 3, 4, 5]);
    expect(state.rollsUsed).toBe(1);
  });

  it('maps the whole rng range to faces 1 to 6', () => {
    expect(unwrap(roll(newGame(), () => 0)).dice).toEqual([1, 1, 1, 1, 1]);
    expect(unwrap(roll(newGame(), () => 0.9999)).dice).toEqual([6, 6, 6, 6, 6]);
  });

  it('keeps held dice and re-rolls the others', () => {
    let state = unwrap(roll(newGame(), fixedRng(6, 6, 2, 3, 6)));
    state = unwrap(toggleHold(state, 0));
    state = unwrap(toggleHold(state, 1));
    state = unwrap(toggleHold(state, 4));
    state = unwrap(roll(state, fixedRng(1, 6)));
    expect(state.dice).toEqual([6, 6, 1, 6, 6]);
    expect(state.rollsUsed).toBe(2);
  });

  it('allows at most three rolls', () => {
    let state = newGame();
    for (let i = 0; i < 3; i++) state = unwrap(roll(state, fixedRng(2)));
    expect(errorOf(roll(state, fixedRng(2)))).toBe('no_rolls_left');
  });

  it('rejects rolling after the game is over', () => {
    const aborted = unwrap(abortGame(newGame()));
    expect(errorOf(roll(aborted, fixedRng(2)))).toBe('game_over');
  });
});

describe('toggleHold', () => {
  it('holds and releases a die', () => {
    let state = unwrap(roll(newGame(), fixedRng(3)));
    state = unwrap(toggleHold(state, 2));
    expect(state.held).toEqual([false, false, true, false, false]);
    state = unwrap(toggleHold(state, 2));
    expect(state.held).toEqual([false, false, false, false, false]);
  });

  it('cannot hold before the first roll', () => {
    expect(errorOf(toggleHold(newGame(), 0))).toBe('not_rolled_yet');
  });

  it('cannot hold after the third roll', () => {
    let state = newGame();
    for (let i = 0; i < 3; i++) state = unwrap(roll(state, fixedRng(4)));
    expect(errorOf(toggleHold(state, 0))).toBe('no_rolls_left');
  });

  it.each([-1, 5, 1.5, Number.NaN])('rejects die index %s', (index) => {
    const state = unwrap(roll(newGame(), fixedRng(4)));
    expect(errorOf(toggleHold(state, index))).toBe('invalid_die_index');
  });

  it('rejects holding after the game is over', () => {
    const aborted = unwrap(abortGame(unwrap(roll(newGame(), fixedRng(4)))));
    expect(errorOf(toggleHold(aborted, 0))).toBe('game_over');
  });
});

describe('chooseBox', () => {
  it('cannot choose before rolling', () => {
    expect(errorOf(chooseBox(newGame(), 'chance'))).toBe('not_rolled_yet');
  });

  it('scores the box and passes the turn to the next player', () => {
    let state = unwrap(roll(newGame(), fixedRng(6, 6, 6, 2, 2)));
    state = unwrap(toggleHold(state, 0));
    state = unwrap(chooseBox(state, 'fullHouse'));
    expect(state.scorecards[0]?.boxes.fullHouse).toBe(25);
    expect(state).toMatchObject({
      currentPlayerIndex: 1,
      round: 1,
      dice: null,
      held: [false, false, false, false, false],
      rollsUsed: 0,
    });
  });

  it('allows scratching a box for 0 even when other boxes score', () => {
    const state = unwrap(chooseBox(unwrap(roll(newGame(), fixedRng(1, 2, 3, 4, 5))), 'yahtzee'));
    expect(state.scorecards[0]?.boxes.yahtzee).toBe(0);
  });

  it('cannot fill a box twice', () => {
    let state = unwrap(chooseBox(unwrap(roll(newGame(), fixedRng(3))), 'chance'));
    state = unwrap(chooseBox(unwrap(roll(state, fixedRng(3))), 'chance'));
    expect(errorOf(chooseBox(unwrap(roll(state, fixedRng(4))), 'chance'))).toBe('box_not_allowed');
  });

  it('enforces the Joker rule and adds the Yahtzee bonus', () => {
    const base = newGame();
    const state: GameState = {
      ...base,
      scorecards: [card({ yahtzee: 50 }), card()],
      dice: dice(4, 4, 4, 4, 4),
      rollsUsed: 1,
    };
    expect(errorOf(chooseBox(state, 'largeStraight'))).toBe('box_not_allowed');
    const after = unwrap(chooseBox(state, 'fours'));
    expect(after.scorecards[0]?.boxes.fours).toBe(20);
    expect(after.scorecards[0]?.yahtzeeBonusCount).toBe(1);
    expect(scores(after)).toEqual([170, 0]);
  });

  it('gives no bonus for a second Yahtzee with 0 in the Yahtzee box', () => {
    const state: GameState = {
      ...newGame(),
      scorecards: [card({ yahtzee: 0 }), card()],
      dice: dice(4, 4, 4, 4, 4),
      rollsUsed: 1,
    };
    expect(errorOf(chooseBox(state, 'chance'))).toBe('box_not_allowed');
    const after = unwrap(chooseBox(state, 'fours'));
    expect(after.scorecards[0]?.boxes.fours).toBe(20);
    expect(after.scorecards[0]?.yahtzeeBonusCount).toBe(0);
    expect(scores(after)).toEqual([20, 0]);
  });

  it.each([
    ['fullHouse', 50, 25, 1],
    ['smallStraight', 50, 30, 1],
    ['largeStraight', 50, 40, 1],
    ['fullHouse', 0, 25, 0],
    ['smallStraight', 0, 30, 0],
    ['largeStraight', 0, 40, 0],
  ] as const)(
    'scores %s as Joker for full value with %i in the Yahtzee box',
    (box, yahtzeeBox, points, bonusCount) => {
      const state: GameState = {
        ...newGame(),
        scorecards: [card({ yahtzee: yahtzeeBox, fours: 12 }), card()],
        dice: dice(4, 4, 4, 4, 4),
        rollsUsed: 1,
      };
      const after = unwrap(chooseBox(state, box));
      expect(after.scorecards[0]?.boxes[box]).toBe(points);
      expect(after.scorecards[0]?.yahtzeeBonusCount).toBe(bonusCount);
    },
  );

  it('rejects choosing after the game is over', () => {
    const aborted = unwrap(abortGame(unwrap(roll(newGame(), fixedRng(4)))));
    expect(errorOf(chooseBox(aborted, 'chance'))).toBe('game_over');
  });
});

/** Plays a full game where every player fills the boxes in order with the same dice. */
function playFullGame(count: number, facesPerPlayer: number[]): GameState {
  let state = newGame(count);
  for (const box of BOX_IDS) {
    for (let p = 0; p < count; p++) {
      expect(state.currentPlayerIndex).toBe(p);
      const face = facesPerPlayer[p] as 1 | 2 | 3 | 4 | 5 | 6;
      state = unwrap(chooseBox(unwrap(roll(state, fixedRng(face))), box));
    }
  }
  return state;
}

describe('full game', () => {
  it('has 13 rounds and then finishes', () => {
    let state = newGame(3);
    for (let round = 1; round <= 13; round++) {
      for (let p = 0; p < 3; p++) {
        expect(state.round).toBe(round);
        expect(state.currentPlayerIndex).toBe(p);
        expect(state.status).toBe('in_progress');
        state = unwrap(chooseBox(unwrap(roll(state, fixedRng(2))), BOX_IDS[round - 1]!));
      }
    }
    expect(state.status).toBe('finished');
    expect(state.round).toBe(13);
    expect(state.dice).toBeNull();
    expect(errorOf(roll(state, fixedRng(1)))).toBe<MoveError>('game_over');
  });

  it('has a single winner with the highest score', () => {
    // Five of a kind every turn; sixes score more than ones.
    const state = playFullGame(2, [1, 6]);
    expect(winners(state)).toEqual(['b']);
  });

  it('declares every player with the highest score a winner on a tie', () => {
    expect(winners(playFullGame(2, [3, 3]))).toEqual(['a', 'b']);
    expect(winners(playFullGame(4, [5, 2, 5, 5]))).toEqual(['a', 'c', 'd']);
  });

  it('scores a game of only Yahtzees correctly', () => {
    // Filling boxes in order with 6-6-6-6-6: Full House and the straights come before the
    // Yahtzee box, so no Joker yet (0). The last turn (chance) is an extra Yahtzee: +100.
    const state = playFullGame(2, [6, 6]);
    expect(state.scorecards[0]?.boxes).toMatchObject({
      sixes: 30,
      threeOfAKind: 30,
      fourOfAKind: 30,
      fullHouse: 0,
      smallStraight: 0,
      largeStraight: 0,
      yahtzee: 50,
      chance: 30,
    });
    expect(state.scorecards[0]?.yahtzeeBonusCount).toBe(1);
    expect(scores(state)).toEqual([270, 270]);
  });
});

describe('abortGame', () => {
  it('marks the game as aborted with no winner and keeps the scores', () => {
    let state = unwrap(chooseBox(unwrap(roll(newGame(), fixedRng(6))), 'sixes'));
    state = unwrap(abortGame(state));
    expect(state.status).toBe('aborted');
    expect(state.round).toBe(1);
    expect(scores(state)).toEqual([30, 0]);
    expect(winners(state)).toEqual([]);
  });

  it('cannot abort a game twice', () => {
    expect(errorOf(abortGame(unwrap(abortGame(newGame()))))).toBe('game_over');
  });
});

describe('winners', () => {
  it('is empty while the game is in progress', () => {
    expect(winners(newGame())).toEqual([]);
  });
});
