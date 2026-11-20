// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dice as DiceValues, Held } from '@yahtzee/game-logic';
import { Dice, ROLL_MS } from '../src/components/Dice';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const NONE: Held = [false, false, false, false, false];

function setup(motion = true) {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: !motion }));
  const onToggle = vi.fn();
  const props = { canHold: true, onToggle, theme: 'snoep' as const };
  const view = render(<Dice {...props} dice={null} held={NONE} rollId="1-0-0" />);
  const show = (dice: DiceValues, held: Held, rollId: string) =>
    view.rerender(<Dice {...props} dice={dice} held={held} rollId={rollId} />);
  const table = () => view.container.querySelector('.cube-dice')!;
  return { onToggle, show, table };
}

describe('Dice', () => {
  it('tumbles after a roll and lands within a second', () => {
    const { show, table } = setup();
    show([1, 2, 3, 4, 5], NONE, '1-0-1');
    expect(table()).toHaveClass('rolling');
    expect(screen.getByRole('button', { name: 'Dobbelsteen 3: 3' })).toBeVisible();
    act(() => vi.advanceTimersByTime(ROLL_MS));
    expect(table()).not.toHaveClass('rolling');
    expect(ROLL_MS).toBeLessThanOrEqual(1000);
  });

  it('keeps held dice still while the others turn', () => {
    const { show } = setup();
    show([1, 2, 3, 4, 5], NONE, '1-0-1');
    const cubes = () =>
      [...document.querySelectorAll<HTMLElement>('.cube')].map((cube) => cube.style.transform);
    const before = cubes();
    show([1, 6, 6, 6, 6], [true, false, false, false, false], '1-0-2');
    const after = cubes();
    expect(after[0]).toBe(before[0]);
    expect(after.slice(1).every((transform, i) => transform !== before[i + 1])).toBe(true);
  });

  it('skips the tumbling with a tap, without holding a die', () => {
    const { onToggle, show, table } = setup();
    show([1, 2, 3, 4, 5], NONE, '1-0-1');
    fireEvent.click(screen.getByRole('button', { name: 'Dobbelsteen 1: 1' }));
    expect(table()).not.toHaveClass('rolling');
    expect(onToggle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dobbelsteen 1: 1' }));
    expect(onToggle).toHaveBeenCalledWith(0);
  });

  it('lands at once when the device wants less motion', () => {
    const { show, table } = setup(false);
    show([6, 6, 6, 6, 6], NONE, '1-0-1');
    expect(table()).not.toHaveClass('rolling');
  });
});
