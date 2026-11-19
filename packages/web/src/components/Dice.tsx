import type { Dice as DiceValues, DieValue, Held } from '@yahtzee/game-logic';
import { nl } from '../i18n/nl';

/** Pip positions on a 3 x 3 grid (1 = top left, 9 = bottom right). */
const PIPS: Record<DieValue, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

export function DieFace({ value }: { value: DieValue | null }) {
  return (
    <span className="die-face" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={value && PIPS[value].includes(i + 1) ? 'pip' : 'pip empty'} />
      ))}
    </span>
  );
}

interface Props {
  dice: DiceValues | null;
  held: Held;
  /** False before the first roll and after the last one. */
  canHold: boolean;
  onToggle: (index: number) => void;
}

export function Dice({ dice, held, canHold, onToggle }: Props) {
  return (
    <div className="dice">
      {held.map((isHeld, i) => {
        const value = dice?.[i] ?? null;
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
            <DieFace value={value} />
            {isHeld && <span className="held-label">{nl.game.held}</span>}
          </button>
        );
      })}
    </div>
  );
}
