// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
import { UnfinishedDialog } from '../src/components/UnfinishedDialog';
import { fetchRecentPlayers } from '../src/api';
import { formatDateTime } from '../src/format';
import type { GameSetup } from '@yahtzee/server/looks';
import type { GameActions } from '../src/useGame';

afterEach(cleanup);

// Confetti needs a real canvas; here it only has to be asked for.
vi.mock('../src/celebrate/confetti', () => ({
  celebrateWinner: vi.fn(() => () => {}),
  celebrateYahtzee: vi.fn(() => () => {}),
  stopConfetti: vi.fn(),
}));

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

/** The player names of the last game setup passed to this mock. */
function names(onStart: { mock: { calls: unknown[][] } }): string[] {
  const setup = onStart.mock.calls.at(-1)![0] as GameSetup;
  return setup.players.map((p) => p.name);
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
    resume: vi.fn(ok),
    discardUnfinished: vi.fn(ok),
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
    render(<SetupScreen onStart={onStart} onBack={() => {}} theme="voetbal" />);
    const [first, second] = screen.getAllByRole('textbox');
    await userEvent.type(first!, 'Emma');
    await userEvent.type(second!, ' emma ');
    await userEvent.click(screen.getByRole('button', { name: 'Start!' }));

    expect(names(onStart)).toEqual(['Emma', ' emma ']);
    expect(screen.getByRole('alert')).toHaveTextContent('dezelfde naam');
  });

  it('offers 2, 3 or 4 players', async () => {
    render(<SetupScreen onStart={vi.fn()} onBack={() => {}} theme="voetbal" />);
    expect(screen.queryByRole('button', { name: '1' })).toBeNull();
    expect(screen.queryByRole('button', { name: '5' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '4' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
  });
});

function recent(name: string, avatar = 'cat', colour = '#7b4fd6') {
  return { name, avatar, colour };
}

/** The last game setup passed to this mock. */
function lastSetup(onStart: { mock: { calls: unknown[][] } }): GameSetup {
  return onStart.mock.calls.at(-1)![0] as GameSetup;
}

async function fillNames(...typed: string[]) {
  const inputs = screen.getAllByRole('textbox');
  for (const [i, name] of typed.entries()) await userEvent.type(inputs[i]!, name);
}

describe('SetupScreen avatars and colours', () => {
  it('starts with theme avatars and different colours, and sends the theme', async () => {
    const onStart = vi.fn(() => Promise.resolve({ ok: true as const }));
    render(<SetupScreen onStart={onStart} onBack={() => {}} theme="snoep" />);
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    await fillNames('Emma', 'Sara', 'Papa');
    await userEvent.click(screen.getByRole('button', { name: 'Start!' }));
    const setup = lastSetup(onStart);
    expect(setup.theme).toBe('snoep');
    expect(setup.players.map((p) => p.avatar)).toEqual(['cupcake', 'lollipop', 'donut']);
    expect(new Set(setup.players.map((p) => p.colour)).size).toBe(3);
  });

  it('lets a player pick an avatar, the same one as someone else is fine', async () => {
    const onStart = vi.fn(() => Promise.resolve({ ok: true as const }));
    render(<SetupScreen onStart={onStart} onBack={() => {}} theme="voetbal" />);
    for (const seat of [1, 2]) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`speler ${seat}:`) }));
      const dialog = screen.getByRole('dialog', { name: /Kies je plaatje/ });
      expect(dialog).toBeVisible();
      await userEvent.click(screen.getByRole('button', { name: 'Eenhoorn' }));
      expect(screen.queryByRole('dialog')).toBeNull();
    }
    await fillNames('Emma', 'Sara');
    await userEvent.click(screen.getByRole('button', { name: 'Start!' }));
    expect(lastSetup(onStart).players.map((p) => p.avatar)).toEqual(['unicorn', 'unicorn']);
  });

  it('only offers colours nobody else has', async () => {
    const onStart = vi.fn(() => Promise.resolve({ ok: true as const }));
    render(<SetupScreen onStart={onStart} onBack={() => {}} theme="voetbal" />);
    const second = screen.getByRole('group', { name: 'Kleur van speler 2' });
    // Player 1 has pink, so player 2 cannot take it.
    expect(within(second).getByRole('button', { name: 'Roze (al gekozen)' })).toBeDisabled();
    await userEvent.click(within(second).getByRole('button', { name: 'Blauw' }));
    expect(within(second).getByRole('button', { name: 'Blauw' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const first = screen.getByRole('group', { name: 'Kleur van speler 1' });
    expect(within(first).getByRole('button', { name: 'Blauw (al gekozen)' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '4' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    await fillNames('A', 'B', 'C');
    await userEvent.click(screen.getByRole('button', { name: 'Start!' }));
    const colours = lastSetup(onStart).players.map((p) => p.colour);
    expect(colours[1]).toBe('#1f6fd1');
    expect(new Set(colours).size).toBe(3);
  });

  it('shuffles the order with "Wie begint?" and keeps each player\'s looks', async () => {
    const onStart = vi.fn(() => Promise.resolve({ ok: true as const }));
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<SetupScreen onStart={onStart} onBack={() => {}} theme="voetbal" />);
    await fillNames('Emma', 'Sara');
    await userEvent.click(screen.getByRole('button', { name: /Wie begint/ }));
    expect(screen.getByRole('button', { name: 'Start!' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start!' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Start!' }));
    expect(lastSetup(onStart).players.map((p) => `${p.name}:${p.avatar}`)).toEqual([
      'Sara:glove',
      'Emma:football',
    ]);
    vi.restoreAllMocks();
  });
});

describe('SetupScreen recent names', () => {
  it('fills the first empty field with a recent name', async () => {
    const onStart = vi.fn(() => Promise.resolve({ ok: true as const }));
    render(
      <SetupScreen
        onStart={onStart}
        onBack={() => {}}
        theme="voetbal"
        recentPlayers={[recent('Emma'), recent('Sara')]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sara meedoen' }));
    expect(
      screen.getAllByRole('textbox').map((input) => (input as HTMLInputElement).value),
    ).toEqual(['Sara', '']);
    // A name already filled in is no longer suggested.
    expect(screen.queryByRole('button', { name: 'Sara meedoen' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Emma meedoen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start!' }));
    expect(names(onStart)).toEqual(['Sara', 'Emma']);
  });

  it('brings back the last avatar and colour of a recent player, if still free', async () => {
    const onStart = vi.fn(() => Promise.resolve({ ok: true as const }));
    render(
      <SetupScreen
        onStart={onStart}
        onBack={() => {}}
        theme="voetbal"
        recentPlayers={[
          recent('Emma', 'panda', '#c62828'),
          recent('Sara', 'fox', '#c62828'),
          recent('Opa', 'old-avatar', '#123456'),
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Emma meedoen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sara meedoen' }));
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Opa meedoen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start!' }));
    const [emma, sara, opa] = lastSetup(onStart).players;
    expect(emma).toEqual({ name: 'Emma', avatar: 'panda', colour: '#c62828' });
    // Red is taken by Emma, so Sara keeps her own colour.
    expect(sara).toMatchObject({ name: 'Sara', avatar: 'fox', colour: '#2e8b57' });
    // Looks that no longer exist are not used.
    expect(opa).toMatchObject({ name: 'Opa', avatar: 'trophy' });
  });

  it('matches names ignoring case and extra spaces, and hides when every field is full', async () => {
    render(
      <SetupScreen
        onStart={vi.fn()}
        onBack={() => {}}
        theme="voetbal"
        recentPlayers={[recent('Anna Sophie'), recent('Noor')]}
      />,
    );
    const [first, second] = screen.getAllByRole('textbox');
    await userEvent.type(first!, ' anna   SOPHIE');
    expect(screen.queryByRole('button', { name: 'Anna Sophie meedoen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Noor meedoen' })).toBeVisible();
    await userEvent.type(second!, 'Lieke');
    expect(screen.queryByText('Eerder gespeeld:')).toBeNull();
  });
});

describe('UnfinishedDialog', () => {
  const game = { players, round: 5, startedAt: '2026-11-19T18:05:00.000Z' };

  it('shows the players, round and start time in Dutch time', () => {
    render(<UnfinishedDialog game={game} onContinue={() => {}} onStop={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: /onafgemaakt spel/ });
    expect(dialog).toHaveTextContent('Emma');
    expect(dialog).toHaveTextContent('Sara');
    expect(dialog).toHaveTextContent('ronde 5 van 13');
    expect(dialog).toHaveTextContent('Begonnen op 19-11-2026 19:05');
  });

  it('needs a choice: continue or stop', async () => {
    const onContinue = vi.fn();
    const onStop = vi.fn();
    render(<UnfinishedDialog game={game} onContinue={onContinue} onStop={onStop} />);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Stoppen' }));
    expect(onStop).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Verder spelen' }));
    expect(onContinue).toHaveBeenCalled();
  });
});

describe('formatDateTime', () => {
  it('shows UTC times in Amsterdam as dd-mm-yyyy HH:mm, in winter and summer', () => {
    expect(formatDateTime('2026-11-19T23:30:00.000Z')).toBe('20-11-2026 00:30');
    expect(formatDateTime('2026-07-01T08:05:00.000Z')).toBe('01-07-2026 10:05');
  });
});

describe('fetchRecentPlayers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the players, or nothing when the server cannot answer', async () => {
    const emma = { id: 'p1', name: 'Emma', avatar: 'cat', colour: '#2e8b57', type: 'human' };
    const reply = (ok: boolean) =>
      vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve([emma]) }));
    vi.stubGlobal('fetch', reply(true));
    expect(await fetchRecentPlayers()).toEqual([
      { name: 'Emma', avatar: 'cat', colour: '#2e8b57' },
    ]);
    vi.stubGlobal('fetch', reply(false));
    expect(await fetchRecentPlayers()).toEqual([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    expect(await fetchRecentPlayers()).toEqual([]);
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
    // Both stand on the highest step of the podium.
    expect(screen.getByRole('listitem', { name: /^Plek 1: Emma/ })).toBeVisible();
    expect(screen.getByRole('listitem', { name: /^Plek 1: Sara/ })).toBeVisible();
  });

  it('puts everybody on the podium with a theme title and throws a party', async () => {
    const { celebrateWinner } = await import('../src/celebrate/confetti');
    render(
      <EndScreen
        state={finished(20, 25)}
        theme="snoep"
        onRematch={() => {}}
        onNewGame={() => {}}
      />,
    );
    const podium = screen.getAllByRole('listitem').filter((li) => li.closest('.podium'));
    expect(podium.map((li) => li.getAttribute('aria-label'))).toEqual([
      'Plek 1: Sara, 25 punten, Snoepkampioen',
      'Plek 2: Emma, 20 punten, Lekkerbek',
    ]);
    expect(podium[0]).toHaveClass('winner');
    expect(celebrateWinner).toHaveBeenCalledWith('snoep');
  });
});
