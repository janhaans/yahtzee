// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LobbyPlayer, LobbyState } from '@yahtzee/server/protocol';
import { JoinForm } from '../src/phone/JoinForm';
import { WaitingRoom } from '../src/phone/WaitingRoom';
import { readProfile, readSeatToken, writeProfile, writeSeatToken } from '../src/settings';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

function player(id: string, name: string, colour: string, phone = false): LobbyPlayer {
  return {
    id,
    name,
    avatar: 'cat',
    colour: colour as LobbyPlayer['colour'],
    controller: phone ? 'phone' : 'table',
    online: true,
  };
}

const lobby: LobbyState = {
  theme: 'snoep',
  players: [player('a', 'Emma', '#e8457c'), player('b', '', '#2e8b57')],
};

const joined = () => Promise.resolve({ ok: true as const, playerId: 'p', token: 't' });

describe('JoinForm', () => {
  it('joins with a name, avatar and a colour nobody has, and remembers them', async () => {
    const onJoin = vi.fn(joined);
    render(<JoinForm lobby={lobby} onJoin={onJoin} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Hoe heet je?' }), 'Sara');
    await userEvent.click(screen.getByRole('button', { name: 'Vos' }));
    const colours = screen.getByRole('group', { name: 'Kies je kleur' });
    // Emma's pink and the green of the empty laptop row are taken.
    expect(within(colours).getByRole('button', { name: 'Roze (al gekozen)' })).toBeDisabled();
    expect(within(colours).getByRole('button', { name: 'Paars' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(within(colours).getByRole('button', { name: 'Blauw' }));
    await userEvent.click(screen.getByRole('button', { name: 'Doe mee!' }));

    const sara = { name: 'Sara', avatar: 'fox', colour: '#1f6fd1' };
    expect(onJoin).toHaveBeenCalledWith(sara);
    expect(readProfile()).toEqual(sara);
  });

  it('fills in last time, but offers another colour when that one is taken now', async () => {
    writeProfile({ name: 'Sara', avatar: 'fox', colour: '#e8457c' });
    const onJoin = vi.fn(joined);
    render(<JoinForm lobby={lobby} onJoin={onJoin} />);
    expect(screen.getByRole('textbox')).toHaveValue('Sara');
    await userEvent.click(screen.getByRole('button', { name: 'Doe mee!' }));
    expect(onJoin).toHaveBeenCalledWith({ name: 'Sara', avatar: 'fox', colour: '#7b4fd6' });
  });

  it('starts with a theme avatar and shows why joining did not work', async () => {
    const onJoin = vi.fn(() =>
      Promise.resolve({ ok: false as const, error: 'duplicate_name' as const }),
    );
    render(<JoinForm lobby={lobby} onJoin={onJoin} />);
    expect(screen.getByRole('button', { name: 'Cupcake' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.type(screen.getByRole('textbox'), 'emma');
    await userEvent.click(screen.getByRole('button', { name: 'Doe mee!' }));
    expect(screen.getByRole('alert')).toHaveTextContent('dezelfde naam');
    expect(readProfile()).toEqual({});
  });
});

describe('WaitingRoom', () => {
  const me = player('s', 'Sara', '#1f6fd1', true);
  const room: LobbyState = { theme: 'voetbal', players: [...lobby.players, me] };
  const ok = () => Promise.resolve({ ok: true as const });

  it('shows who joined, where they play, and lets this phone change its looks or leave', async () => {
    const onChange = vi.fn(ok);
    const onLeave = vi.fn(ok);
    render(<WaitingRoom lobby={room} me={me} onChange={onChange} onLeave={onLeave} />);
    expect(screen.getByRole('heading', { name: 'Je doet mee, Sara!' })).toBeVisible();
    const list = screen.getByRole('list');
    // The empty laptop row is not shown.
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['🐱Emma💻', '🐱Sara (jij)📱']);

    await userEvent.click(screen.getByRole('button', { name: 'Plaatje of kleur veranderen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Panda' }));
    expect(onChange).toHaveBeenCalledWith({ avatar: 'panda' });
    await userEvent.click(screen.getByRole('button', { name: 'Oranje' }));
    expect(onChange).toHaveBeenCalledWith({ colour: '#d66a00' });
    await userEvent.click(screen.getByRole('button', { name: 'Klaar' }));
    expect(screen.queryByRole('button', { name: 'Panda' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Toch niet meedoen' }));
    expect(onLeave).toHaveBeenCalled();
  });

  it('shows an error from the server', async () => {
    const fail = () => Promise.resolve({ ok: false as const, error: 'duplicate_colour' as const });
    render(<WaitingRoom lobby={room} me={me} onChange={fail} onLeave={ok} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plaatje of kleur veranderen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Oranje' }));
    expect(screen.getByRole('alert')).toHaveTextContent('dezelfde kleur');
  });
});

describe('phone storage', () => {
  it('keeps the seat token, also when storage is blocked', () => {
    expect(readSeatToken()).toBeNull();
    writeSeatToken('abc');
    expect(readSeatToken()).toBe('abc');

    localStorage.clear();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    writeSeatToken('def');
    // Remembered in this page only.
    expect(readSeatToken()).toBe('def');
    expect(readProfile()).toEqual({});
  });

  it('ignores a damaged profile', () => {
    localStorage.setItem('yahtzee.me', '{nope');
    expect(readProfile()).toEqual({});
    localStorage.setItem('yahtzee.me', JSON.stringify({ name: 5, avatar: 'x', colour: '#e8457c' }));
    expect(readProfile()).toEqual({ colour: '#e8457c' });
  });
});
