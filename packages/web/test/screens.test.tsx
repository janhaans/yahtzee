// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createGame,
  emptyScorecard,
  type Dice,
  type GameState,
  type Player,
  type Scorecard,
} from '@yahtzee/game-logic';
import { EndScreen } from '../src/components/EndScreen';
import { GameScreen } from '../src/components/GameScreen';
import { ScoreTable } from '../src/components/ScoreTable';
import { SetupScreen } from '../src/components/SetupScreen';
import type { GameActions } from '../src/useGame';

afterEach(cleanup);

const players: Player[] = [
  { id: 'a', name: 'Emma', avatar: 'cupcake', colour: '#e8457c', type: 'human' },
  { id: 'b', name: 'Sara', avatar: 'football', colour: '#2e8b57', type: 'human' },
];

function card(filled: Partial<Scorecard['boxes']> = {}): Scorecard {
  return { boxes: { ...emptyScorecard().boxes, ...filled }, yahtzeeBonusCount: 0 };
}

function gameWith(dice: Dice, first: Scorecard = card()): GameState {
  const result = createGame(players);
  if (!result.ok) throw new Error(result.error);
  return { ...result.state, dice, rollsUsed: 1, scorecards: [first, card()] };
}

function fakeActions(): GameActions {
  const ok = () => Promise.resolve({ ok: true as const });
  return {
    create: vi.fn(ok),
    roll: vi.fn(ok),
    toggleHold: vi.fn(ok),
    chooseBox: vi.fn(ok),
    abort: vi.fn(ok),
    rematch: vi.fn(ok),
  };
}

describe('ScoreTable', () => {
  it('shows a point preview for every empty box', () => {
    render(
      <ScoreTable
        players={[players[0]!]}
        scorecards={[card({ chance: 20 })]}
        choose={{ dice: [3, 3, 3, 5, 5], onChoose: () => {} }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Full House: 25' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Drie gelijke: 19' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Yahtzee: 0' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /^Kans/ })).toBeNull();
  });

  it('only enables the boxes the Joker rule allows', () => {
    render(
      <ScoreTable
        players={[players[0]!]}
        scorecards={[card({ yahtzee: 50 })]}
        choose={{ dice: [6, 6, 6, 6, 6], onChoose: () => {} }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Zessen: 30' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Full House' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Kans' })).toBeDisabled();
  });

  it('explains a box with the (i) button', async () => {
    render(<ScoreTable players={players} scorecards={[card(), card()]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Uitleg Full House' }));
    expect(screen.getByRole('dialog', { name: 'Full House' })).toHaveTextContent(
      '3 3 3 5 5 geeft 25 punten.',
    );
  });
});

describe('GameScreen', () => {
  it('asks for confirmation before scoring', async () => {
    const actions = fakeActions();
    render(<GameScreen state={gameWith([2, 3, 4, 5, 6])} actions={actions} />);

    await userEvent.click(screen.getByRole('button', { name: 'Grote straat: 40' }));
    expect(screen.getByRole('dialog', { name: '40 punten bij Grote straat?' })).toBeVisible();
    expect(actions.chooseBox).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Ja!' }));
    expect(actions.chooseBox).toHaveBeenCalledWith('largeStraight');
  });

  it('always asks for confirmation before scratching, and can go back', async () => {
    const actions = fakeActions();
    render(<GameScreen state={gameWith([1, 1, 2, 2, 3])} actions={actions} />);

    await userEvent.click(screen.getByRole('button', { name: 'Yahtzee: 0' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('0 punten bij Yahtzee?');
    await userEvent.click(screen.getByRole('button', { name: 'Nee, terug' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(actions.chooseBox).not.toHaveBeenCalled();
  });

  it('mentions the Yahtzee bonus when it is earned', async () => {
    const state = gameWith([5, 5, 5, 5, 5], card({ yahtzee: 50 }));
    render(<GameScreen state={state} actions={fakeActions()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Vijven: 25' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('100 bonuspunten');
  });

  it('shows whose turn it is and the round', () => {
    render(<GameScreen state={gameWith([1, 2, 3, 4, 6])} actions={fakeActions()} />);
    expect(screen.getByRole('heading', { name: /Emma is aan de beurt!/ })).toBeVisible();
    expect(screen.getByText('Ronde 1 van 13')).toBeVisible();
  });

  it('asks before stopping the game', async () => {
    const actions = fakeActions();
    render(<GameScreen state={gameWith([1, 2, 3, 4, 6])} actions={actions} />);
    await userEvent.click(screen.getByRole('button', { name: 'Stop spel' }));
    expect(actions.abort).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ja, stoppen' }));
    expect(actions.abort).toHaveBeenCalled();
  });
});

describe('SetupScreen', () => {
  it('shows the server error in Dutch', async () => {
    const onStart = vi.fn(() =>
      Promise.resolve({ ok: false as const, error: 'duplicate_name' as const }),
    );
    render(<SetupScreen onStart={onStart} onBack={() => {}} />);
    const [first, second] = screen.getAllByRole('textbox');
    await userEvent.type(first!, 'Emma');
    await userEvent.type(second!, ' emma ');
    await userEvent.click(screen.getByRole('button', { name: 'Start!' }));

    expect(onStart).toHaveBeenCalledWith(['Emma', ' emma ']);
    expect(screen.getByRole('alert')).toHaveTextContent('dezelfde naam');
  });

  it('offers 2, 3 or 4 players', async () => {
    render(<SetupScreen onStart={vi.fn()} onBack={() => {}} />);
    expect(screen.queryByRole('button', { name: '1' })).toBeNull();
    expect(screen.queryByRole('button', { name: '5' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '4' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
  });
});

describe('EndScreen', () => {
  const full = (chance: number): Scorecard => ({
    boxes: {
      ...card().boxes,
      ones: 0,
      twos: 0,
      threes: 0,
      fours: 0,
      fives: 0,
      sixes: 0,
      threeOfAKind: 0,
      fourOfAKind: 0,
      fullHouse: 0,
      smallStraight: 0,
      largeStraight: 0,
      yahtzee: 0,
      chance,
    },
    yahtzeeBonusCount: 0,
  });
  const finished = (...chances: number[]): GameState => ({
    ...gameWith([1, 2, 3, 4, 6]),
    status: 'finished',
    dice: null,
    scorecards: chances.map(full),
  });

  it('names the winner', () => {
    render(<EndScreen state={finished(20, 25)} onRematch={() => {}} onNewGame={() => {}} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sara wint!');
  });

  it('shows a tie with all winners', () => {
    render(<EndScreen state={finished(25, 25)} onRematch={() => {}} onNewGame={() => {}} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Gelijkspel! Emma en Sara winnen samen!',
    );
    expect(screen.getAllByText(/🏆$/)).toHaveLength(2);
  });
});
