// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartScreen } from '../src/components/StartScreen';
import { useMuted, useThemePreference } from '../src/settings';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('settings', () => {
  it('remembers the theme and sound on this device', () => {
    const theme = renderHook(() => useThemePreference());
    expect(theme.result.current[0]).toBe('voetbal');
    act(() => theme.result.current[1]('snoep'));
    expect(theme.result.current[0]).toBe('snoep');
    expect(renderHook(() => useThemePreference()).result.current[0]).toBe('snoep');

    const muted = renderHook(() => useMuted());
    expect(muted.result.current[0]).toBe(false);
    act(() => muted.result.current[1](true));
    expect(renderHook(() => useMuted()).result.current[0]).toBe(true);
  });

  it('ignores an unknown stored theme', () => {
    localStorage.setItem('yahtzee.theme', 'ruimte');
    expect(renderHook(() => useThemePreference()).result.current[0]).toBe('voetbal');
  });

  it('still works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const theme = renderHook(() => useThemePreference());
    expect(theme.result.current[0]).toBe('voetbal');
    act(() => theme.result.current[1]('snoep'));
    expect(theme.result.current[0]).toBe('snoep');
  });
});

describe('StartScreen', () => {
  it('shows both themes and picks one', async () => {
    const onTheme = vi.fn();
    render(<StartScreen theme="voetbal" onTheme={onTheme} onNewGame={() => {}} />);
    expect(screen.getByRole('button', { name: /Voetbalstadion/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: /Snoepwinkel/ }));
    expect(onTheme).toHaveBeenCalledWith('snoep');
  });

  it('says whether the sound is on and switches it', async () => {
    const onMute = vi.fn();
    render(
      <StartScreen theme="snoep" onTheme={() => {}} muted onMute={onMute} onNewGame={() => {}} />,
    );
    const sound = screen.getByRole('switch', { name: 'Geluid' });
    expect(sound).toHaveAttribute('aria-checked', 'false');
    expect(sound).toHaveTextContent('Geluid uit');
    await userEvent.click(sound);
    expect(onMute).toHaveBeenCalledWith(false);
  });
});
