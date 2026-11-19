import {
  BOX_IDS,
  isYahtzee,
  totals,
  winners,
  type BoxId,
  type Dice,
  type GameState,
  type Held,
} from '@yahtzee/game-logic';

/**
 * What just happened at the table, worked out by comparing two game states. The server only
 * sends states, so every screen (laptop and phones) finds the same events this way.
 */
export type GameEvent =
  | { readonly kind: 'newGame' }
  | { readonly kind: 'turn'; readonly seat: number }
  | {
      readonly kind: 'rolled';
      readonly seat: number;
      readonly dice: Dice;
      /** Which dice stayed put during this roll. */
      readonly held: Held;
      /** 1, 2 or 3. */
      readonly roll: number;
      readonly yahtzee: boolean;
    }
  | {
      readonly kind: 'scored';
      readonly seat: number;
      readonly box: BoxId;
      readonly points: number;
      /** This box made the upper section reach 63: +35. */
      readonly upperBonus: boolean;
      /** This was an extra Yahtzee: +100. */
      readonly yahtzeeBonus: boolean;
    }
  | { readonly kind: 'gameOver'; readonly winners: readonly string[] };

function samePlayers(a: GameState, b: GameState): boolean {
  return (
    a.players.length === b.players.length && a.players.every((p, i) => p.id === b.players[i]!.id)
  );
}

/** The events between two states. A null `prev` means there was no game before. */
export function gameEvents(prev: GameState | null, next: GameState | null): GameEvent[] {
  if (next === null) return [];
  const started = next.status === 'in_progress';
  const newGame =
    started && (prev === null || prev.status !== 'in_progress' || !samePlayers(prev, next));
  if (newGame) return [{ kind: 'newGame' }, { kind: 'turn', seat: next.currentPlayerIndex }];
  if (prev === null || prev.status !== 'in_progress') return [];

  const events: GameEvent[] = [];
  const seat = prev.currentPlayerIndex;

  if (next.rollsUsed > prev.rollsUsed && next.currentPlayerIndex === seat && next.dice) {
    events.push({
      kind: 'rolled',
      seat,
      dice: next.dice,
      held: next.held,
      roll: next.rollsUsed,
      yahtzee: isYahtzee(next.dice),
    });
  }

  const before = prev.scorecards[seat]!;
  const after = next.scorecards[seat]!;
  const box = BOX_IDS.find((id) => before.boxes[id] === null && after.boxes[id] !== null);
  if (box) {
    events.push({
      kind: 'scored',
      seat,
      box,
      points: after.boxes[box]!,
      upperBonus: totals(before).upperBonus === 0 && totals(after).upperBonus > 0,
      yahtzeeBonus: after.yahtzeeBonusCount > before.yahtzeeBonusCount,
    });
  }

  if (next.status === 'finished') {
    events.push({ kind: 'gameOver', winners: winners(next) });
  } else if (started && next.currentPlayerIndex !== seat) {
    events.push({ kind: 'turn', seat: next.currentPlayerIndex });
  }
  return events;
}
