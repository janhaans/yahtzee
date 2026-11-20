// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  abortGame,
  chooseBox,
  createGame,
  emptyScorecard,
  roll,
  toggleHold,
  type BoxId,
  type GameState,
  type Player,
  type Result,
} from '@yahtzee/game-logic';
import { THEMES } from '@yahtzee/server/looks';
import { DICE_LAND_MS, FunLayer } from '../src/components/FunLayer';
import { playerTitles } from '../src/fun/titles';
import { gameEvents } from '../src/fun/events';
import { MESSAGE_KINDS, MessagePicker, messageKind } from '../src/fun/messages';
import { nl } from '../src/i18n/nl';
import { sound } from '../src/sound/engine';

vi.mock('../src/celebrate/confetti', () => ({
  celebrateWinner: vi.fn(() => () => {}),
  celebrateYahtzee: vi.fn(() => () => {}),
  stopConfetti: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const players: Player[] = [
  { id: 'a', name: 'Emma', avatar: 'cupcake', colour: '#e8457c', type: 'human' },
  { id: 'b', name: 'Sara', avatar: 'football', colour: '#2e8b57', type: 'human' },
];

function ok(result: Result<unknown>): GameState {
  if (!result.ok) throw new Error(String(result.error));
  return result.state;
}

/** Dice that always land on this face. */
const always = (face: number) => () => (face - 1) / 6 + 0.01;

function newGame(): GameState {
  return ok(createGame(players));
}

describe('gameEvents', () => {
  it('starts a game with the first turn', () => {
    const game = newGame();
    expect(gameEvents(null, game)).toEqual([{ kind: 'newGame' }, { kind: 'turn', seat: 0 }]);
    expect(gameEvents(null, null)).toEqual([]);
    expect(gameEvents(game, null)).toEqual([]);
    expect(gameEvents(game, game)).toEqual([]);
  });

  it('sees a roll, which dice were held and a Yahtzee', () => {
    const start = newGame();
    const first = ok(roll(start, always(4)));
    expect(gameEvents(start, first)).toEqual([
      {
        kind: 'rolled',
        seat: 0,
        dice: [4, 4, 4, 4, 4],
        held: [false, false, false, false, false],
        roll: 1,
        yahtzee: true,
      },
    ]);
    const held = ok(toggleHold(first, 1));
    expect(gameEvents(first, held)).toEqual([{ kind: 'held', seat: 0, index: 1, held: true }]);
    expect(gameEvents(held, ok(toggleHold(held, 1)))).toEqual([
      { kind: 'held', seat: 0, index: 1, held: false },
    ]);
    let n = 0;
    const second = ok(roll(held, () => [0, 0.2, 0.4, 0.6][n++ % 4]!));
    expect(gameEvents(held, second)).toEqual([
      expect.objectContaining({
        kind: 'rolled',
        held: [false, true, false, false, false],
        roll: 2,
        yahtzee: false,
      }),
    ]);
  });

  it('sees a scored box, the next turn and the bonuses', () => {
    const rolled = ok(roll(newGame(), always(6)));
    const scored = ok(chooseBox(rolled, 'yahtzee'));
    expect(gameEvents(rolled, scored)).toEqual([
      {
        kind: 'scored',
        seat: 0,
        box: 'yahtzee',
        points: 50,
        upperBonus: false,
        yahtzeeBonus: false,
      },
      { kind: 'turn', seat: 1 },
    ]);

    // Emma has 60 in the upper boxes; her extra Yahtzee of sixes also brings the bonus.
    const card = {
      boxes: { ...emptyScorecard().boxes, yahtzee: 50, fives: 25, fours: 20, threes: 15 },
      yahtzeeBonusCount: 0,
    };
    const before = { ...rolled, scorecards: [card, emptyScorecard()] };
    const after = ok(chooseBox(before, 'sixes'));
    expect(gameEvents(before, after)[0]).toMatchObject({
      kind: 'scored',
      box: 'sixes',
      points: 30,
      upperBonus: true,
      yahtzeeBonus: true,
    });
  });

  it('ends with the winners, and an aborted game gives no turn', () => {
    const full = Object.fromEntries(
      Object.keys(emptyScorecard().boxes).map((box) => [box, 0]),
    ) as Record<BoxId, number>;
    const almost = (last: BoxId) => ({
      boxes: { ...full, [last]: null },
      yahtzeeBonusCount: 0,
    });
    const lastTurn: GameState = {
      ...ok(roll(newGame(), always(2))),
      round: 13,
      currentPlayerIndex: 1,
      scorecards: [{ boxes: full, yahtzeeBonusCount: 0 }, almost('chance')],
    };
    const finished = ok(chooseBox(lastTurn, 'chance'));
    expect(gameEvents(lastTurn, finished)).toEqual([
      expect.objectContaining({ kind: 'scored', seat: 1, points: 10 }),
      { kind: 'gameOver', winners: ['b'] },
    ]);
    // After the end, nothing more happens until a rematch starts a new game.
    expect(gameEvents(finished, finished)).toEqual([]);
    expect(gameEvents(finished, newGame())).toEqual([
      { kind: 'newGame' },
      { kind: 'turn', seat: 0 },
    ]);

    const game = newGame();
    expect(gameEvents(game, ok(abortGame(game)))).toEqual([]);
  });

  it('sees a different game with other players as new', () => {
    const other = ok(createGame([players[1]!, { ...players[0]!, id: 'c' }]));
    expect(gameEvents(newGame(), other)[0]).toEqual({ kind: 'newGame' });
    const three = ok(createGame([...players, { ...players[0]!, id: 'd', name: 'Noor' }]));
    expect(gameEvents(newGame(), three)[0]).toEqual({ kind: 'newGame' });
  });
});

describe('messages', () => {
  const scored = (box: BoxId, points: number, extra = {}) =>
    ({
      kind: 'scored',
      seat: 0,
      box,
      points,
      upperBonus: false,
      yahtzeeBonus: false,
      ...extra,
    }) as const;

  it('fits the most special thing that happened', () => {
    expect(messageKind(scored('sixes', 30, { yahtzeeBonus: true }))).toBe('yahtzeeBonus');
    expect(messageKind(scored('yahtzee', 50))).toBe('yahtzee');
    expect(messageKind(scored('yahtzee', 0))).toBe('zero');
    expect(messageKind(scored('fours', 16, { upperBonus: true }))).toBe('bonus');
    expect(messageKind(scored('largeStraight', 40))).toBe('largeStraight');
    expect(messageKind(scored('largeStraight', 0))).toBe('zero');
    expect(messageKind(scored('smallStraight', 30))).toBe('smallStraight');
    expect(messageKind(scored('fullHouse', 25))).toBe('fullHouse');
    expect(messageKind(scored('chance', 24))).toBe('high');
    expect(messageKind(scored('chance', 23))).toBe('good');
  });

  it('has at least 30 different messages per theme, and a few of every kind', () => {
    for (const theme of THEMES) {
      const all = MESSAGE_KINDS.flatMap((kind) => nl.messages[theme][kind]);
      expect(new Set(all).size).toBe(all.length);
      expect(all.length).toBeGreaterThanOrEqual(30);
      for (const kind of MESSAGE_KINDS) {
        expect(nl.messages[theme][kind].length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('keeps every message and title kind and gender-neutral', () => {
    const texts = THEMES.flatMap((theme) =>
      MESSAGE_KINDS.flatMap((kind) => nl.messages[theme][kind]),
    );
    const unkind =
      /\b(dom|stom|sukkel|loser|verliezer|slecht|koning|koningin|man|vrouw|jongens|meisjes)\b/i;
    expect(texts.filter((text) => unkind.test(text))).toEqual([]);
  });

  it('does not repeat a recent message', () => {
    const picker = new MessagePicker(() => 0);
    const zero = nl.messages.voetbal.zero;
    const picked = zero.map(() => picker.pick('voetbal', 'zero'));
    expect(new Set(picked).size).toBe(zero.length);
    // When every message was shown recently, it starts over instead of failing.
    expect(zero).toContain(picker.pick('voetbal', 'zero'));
    // Only the last few are remembered, so an old message can come back later.
    const good = nl.messages.snoep.good;
    const many = Array.from({ length: good.length + 1 }, () => picker.pick('snoep', 'good'));
    expect(new Set(many.slice(0, good.length)).size).toBe(good.length);
    expect(many.at(-1)).toBe(many[0]);
  });
});

describe('FunLayer', () => {
  function setup() {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const start = newGame();
    const view = render(<FunLayer state={undefined} theme="voetbal" />);
    const show = (state: GameState | null) =>
      view.rerender(<FunLayer state={state} theme="voetbal" />);
    show(null);
    return { start, show };
  }

  it('marks a turn change with only a soft sound: no pop-up, nothing to tap away', () => {
    const play = vi.spyOn(sound, 'play').mockImplementation(() => {});
    const { start, show } = setup();
    show(start);
    expect(play).toHaveBeenLastCalledWith('turn', 'voetbal');
    show(ok(chooseBox(ok(roll(start, always(1))), 'ones')));
    expect(play).toHaveBeenLastCalledWith('turn', 'voetbal');
    expect(screen.queryByText(/is aan de beurt/)).toBeNull();
    expect(document.querySelector('.turn-overlay')).toBeNull();
  });

  it('shows a theme message after scoring', () => {
    const { start, show } = setup();
    show(start);
    const rolled = ok(roll(start, always(3)));
    show(rolled);
    show(ok(chooseBox(rolled, 'chance')));
    expect(nl.messages.voetbal.good).toContain(screen.getByRole('status').textContent);
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('celebrates a Yahtzee once the dice have landed; a tap ends it', async () => {
    const { celebrateYahtzee } = await import('../src/celebrate/confetti');
    const { start, show } = setup();
    show(start);
    act(() => vi.advanceTimersByTime(2000));
    show(ok(roll(start, always(6))));
    expect(screen.queryByText('YAHTZEE!!!')).toBeNull();
    act(() => vi.advanceTimersByTime(DICE_LAND_MS));
    expect(screen.getByText('YAHTZEE!!!')).toBeVisible();
    expect(screen.getByText('GOOOAL!')).toBeVisible();
    expect(celebrateYahtzee).toHaveBeenCalledWith('voetbal');
    fireEvent.click(screen.getByText('YAHTZEE!!!'));
    expect(screen.queryByText('YAHTZEE!!!')).toBeNull();
  });

  it('celebrates calmly and at once when the device wants less motion', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const start = newGame();
    const view = render(<FunLayer state={start} theme="snoep" />);
    view.rerender(<FunLayer state={ok(roll(start, always(2)))} theme="snoep" />);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByText('Het regent snoep!')).toBeVisible();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('YAHTZEE!!!')).toBeNull();
  });

  it('plays nothing for the first state after connecting', () => {
    const play = vi.spyOn(sound, 'play').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const view = render(<FunLayer state={undefined} theme="snoep" />);
    view.rerender(<FunLayer state={newGame()} theme="snoep" />);
    expect(play).not.toHaveBeenCalled();
  });
});

describe('playerTitles', () => {
  const four: Player[] = [
    ...players,
    { id: 'c', name: 'Noor', avatar: 'cat', colour: '#7b4fd6', type: 'human' },
    { id: 'd', name: 'Papa', avatar: 'dog', colour: '#d66a00', type: 'human' },
  ];
  const card = (filled: Partial<Record<BoxId, number>>, yahtzeeBonusCount = 0) => ({
    boxes: { ...emptyScorecard().boxes, ...filled },
    yahtzeeBonusCount,
  });
  const game = (cards: ReturnType<typeof card>[], who = four): GameState => ({
    ...ok(createGame(who.slice(0, cards.length))),
    status: 'finished',
    scorecards: cards,
  });

  it('gives the winner the winner title and everybody else what they did best', () => {
    const titles = playerTitles(
      game([
        card({ chance: 30, ones: 5 }), // the best single box of the others
        card({ yahtzee: 50 }, 1), // a Yahtzee plus a bonus Yahtzee: 150 points, the winner
        card({ ones: 3, twos: 6, threes: 9, fours: 16, fives: 20, sixes: 18 }),
        card({ chance: 5, ones: 0, twos: 0 }),
      ]),
      'voetbal',
    );
    expect(titles).toEqual({
      b: 'Speler van de wedstrijd',
      c: 'Bonusjager',
      a: 'Topscorer',
      d: 'Durfal van het veld',
    });
  });

  it('shares the winner title in a tie and finds a friendly title for the rest', () => {
    const titles = playerTitles(
      game([card({ chance: 20 }), card({ chance: 20 }), card({ chance: 10 }), card({})]),
      'snoep',
    );
    expect(titles.a).toBe('Snoepkampioen');
    expect(titles.b).toBe('Snoepkampioen');
    expect(titles.c).toBe('Lekkerbek');
    expect(titles.d).toBe('Lollyliefhebber');
  });

  it('never gives two others the same title', () => {
    const titles = playerTitles(
      game([card({ chance: 30 }), card({}), card({}), card({})]),
      'voetbal',
    );
    expect(Object.values(titles)).toEqual([
      'Speler van de wedstrijd',
      'Teamspeler',
      'Supporter van het jaar',
      'Talent van de toekomst',
    ]);
  });

  it('makes whoever scored the most straights the Straatmeester', () => {
    const titles = playerTitles(
      game([
        card({ chance: 400 }),
        card({ smallStraight: 30 }),
        card({ smallStraight: 30, largeStraight: 40 }),
        card({ smallStraight: 0, largeStraight: 0 }),
      ]),
      'voetbal',
    );
    expect(titles).toMatchObject({
      c: 'Straatmeester',
      b: 'Topscorer',
      d: 'Durfal van het veld',
    });
  });

  it('gives the Yahtzee title to whoever threw the most Yahtzees', () => {
    const titles = playerTitles(
      game([card({ chance: 400 }), card({ yahtzee: 50 }), card({ yahtzee: 50 }, 2)]),
      'snoep',
    );
    expect(titles).toMatchObject({ c: 'Jackpot-snoeper', b: 'Lekkerbek' });
  });
});
