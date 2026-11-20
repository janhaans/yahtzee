import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { Dice as DiceValues, DieValue, Held } from '@yahtzee/game-logic';
import type { ThemeId } from '@yahtzee/server/looks';
import { nl } from '../i18n/nl';
import { reducedMotion } from '../motion';
import { sound } from '../sound/engine';
import { THEMES } from '../themes';

/** Pip positions on a 3 x 3 grid (1 = top left, 9 = bottom right). */
const PIPS: Record<DieValue, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const VALUES: readonly DieValue[] = [1, 2, 3, 4, 5, 6];

/** How the cube turns (degrees around X and Y) to show each value at the front. */
const SHOW: Record<DieValue, readonly [number, number]> = {
  1: [0, 0],
  2: [0, -90],
  3: [-90, 0],
  4: [90, 0],
  5: [0, 90],
  6: [0, 180],
};

/** A roll lasts at most this long (PRD: no more than 1 second), including the stagger. */
export const ROLL_MS = 850;
const STAGGER_MS = 40;

export function DieFace({ value }: { value: DieValue | null }) {
  return (
    <span className="die-face" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={value && PIPS[value].includes(i + 1) ? 'pip' : 'pip empty'} />
      ))}
    </span>
  );
}

/** Extra full turns for each die, so every roll visibly tumbles, even to the same value. */
function addSpins(spins: readonly (readonly [number, number])[], held: Held) {
  return spins.map(([x, y], i) =>
    held[i]
      ? ([x, y] as const)
      : ([x + 1 + Math.floor(Math.random() * 2), y + 1 + Math.floor(Math.random() * 2)] as const),
  );
}

interface Props {
  dice: DiceValues | null;
  held: Held;
  /** False before the first roll and after the last one. */
  canHold: boolean;
  onToggle: (index: number) => void;
  theme: ThemeId;
  /** Changes with every roll; a new value makes the dice that are not held tumble. */
  rollId: string;
  /**
   * 'cubes' draws CSS 3D cubes. 'buttons' only keeps the (invisible) die buttons, for when
   * the 3D dice are drawn on top.
   */
  variant?: 'cubes' | 'buttons';
  /** The row of die buttons, for the 3D dice to land under. */
  rowRef?: RefObject<HTMLDivElement | null>;
}

/**
 * Five CSS 3D cubes that tumble and land on the values the server rolled. Light enough for
 * every phone. Tapping the table skips the tumbling.
 */
export function Dice({
  dice,
  held,
  canHold,
  onToggle,
  theme,
  rollId,
  variant = 'cubes',
  rowRef,
}: Props) {
  const [spins, setSpins] = useState<readonly (readonly [number, number])[]>(() =>
    held.map(() => [0, 0] as const),
  );
  const [rolling, setRolling] = useState(false);
  const lastRoll = useRef(rollId);
  const latest = useRef({ dice, held, theme, variant });
  latest.current = { dice, held, theme, variant };

  // A new roll: the dice that were not held get extra turns, so they tumble to their value.
  useEffect(() => {
    if (rollId === lastRoll.current) return;
    lastRoll.current = rollId;
    const now = latest.current;
    // The 3D dice make their own sound with every bounce.
    if (now.dice === null || now.variant === 'buttons') return;
    sound.play('roll', now.theme);
    if (reducedMotion()) return;
    setSpins((current) => addSpins(current, latest.current.held));
    setRolling(true);
  }, [rollId]);

  useEffect(() => {
    if (!rolling) return;
    const timer = setTimeout(() => setRolling(false), ROLL_MS);
    return () => clearTimeout(timer);
  }, [rolling, spins]);

  const look = THEMES[theme].dice;
  const style = {
    '--die-face': look.face,
    '--die-pip': look.pip,
    '--die-edge': look.edge,
    '--die-pattern': look.patternColour,
    '--die-rounding': `${look.rounding * 100}%`,
  } as CSSProperties;

  return (
    <div
      ref={rowRef}
      className={`dice ${variant === 'cubes' ? 'cube-dice' : 'button-dice'}${rolling ? ' rolling' : ''}${dice === null ? ' empty' : ''}`}
      data-pattern={look.pattern}
      style={style}
      onClickCapture={(event) => {
        // The first tap during a roll only skips the animation.
        if (!rolling) return;
        event.stopPropagation();
        setRolling(false);
      }}
    >
      {held.map((isHeld, i) => {
        const value = dice?.[i] ?? null;
        const [turnsX, turnsY] = spins[i]!;
        const [x, y] = SHOW[value ?? 1];
        const cubeStyle: CSSProperties = {
          transform: `rotateX(${x + turnsX * 360}deg) rotateY(${y + turnsY * 360}deg)`,
          transitionDelay: `${i * STAGGER_MS}ms`,
        };
        return (
          <button
            key={i}
            type="button"
            className={isHeld ? 'die held' : 'die'}
            aria-pressed={isHeld}
            aria-label={nl.game.die(i + 1, value, isHeld)}
            disabled={!canHold}
            onClick={() => onToggle(i)}
          >
            {variant === 'cubes' && (
              <span className="cube" style={cubeStyle} aria-hidden="true">
                {VALUES.map((face) => (
                  <span key={face} className={`cube-face face-${face}`}>
                    <DieFace value={dice ? face : null} />
                  </span>
                ))}
              </span>
            )}
            {isHeld && <span className="held-label">{nl.game.held}</span>}
          </button>
        );
      })}
    </div>
  );
}
