import { BOX_IDS, totals, winners, type GameState, type Scorecard } from '@yahtzee/game-logic';
import type { ThemeId } from '@yahtzee/server/looks';
import { nl } from '../i18n/nl';

/** Something a player can stand out in, with the title it earns. */
type Award = 'yahtzee' | 'bonus' | 'straights' | 'bestBox' | 'bravest';

/** How good a scorecard is at each award; 0 means it does not qualify. */
const MEASURES: Record<Award, (card: Scorecard) => number> = {
  yahtzee: (card) => (card.boxes.yahtzee === 50 ? 1 : 0) + card.yahtzeeBonusCount,
  bonus: (card) => totals(card).upperBonus,
  // Small and large straights that scored.
  straights: (card) => (card.boxes.smallStraight ? 1 : 0) + (card.boxes.largeStraight ? 1 : 0),
  bestBox: (card) => Math.max(...BOX_IDS.map((box) => card.boxes[box] ?? 0)),
  // A scratch takes courage; the player with the most gets a cheerful title for it.
  bravest: (card) => BOX_IDS.filter((box) => card.boxes[box] === 0).length,
};

const AWARDS: readonly Award[] = ['yahtzee', 'bonus', 'straights', 'bestBox', 'bravest'];

/**
 * A fun, positive title for every player at the end of a game, by player id. The winners
 * share the winner's title; everybody else gets the thing they did best, or a friendly
 * title when nothing stood out. Titles are gender-neutral: anybody can play.
 */
export function playerTitles(state: GameState, theme: ThemeId): Record<string, string> {
  const titles = nl.titles[theme];
  const winnerIds = new Set(winners(state));
  const result: Record<string, string> = {};

  // Others in ranking order, so the best players get the first pick.
  const others = state.players
    .map((player, seat) => ({ player, card: state.scorecards[seat]!, seat }))
    .filter(({ player }) => !winnerIds.has(player.id))
    .sort((a, b) => totals(b.card).grandTotal - totals(a.card).grandTotal || a.seat - b.seat);

  for (const player of state.players) {
    if (winnerIds.has(player.id)) result[player.id] = titles.winner;
  }

  for (const award of AWARDS) {
    let best: (typeof others)[number] | null = null;
    for (const entry of others) {
      if (result[entry.player.id]) continue;
      const score = MEASURES[award](entry.card);
      if (score > 0 && (!best || score > MEASURES[award](best.card))) best = entry;
    }
    if (best) result[best.player.id] = titles[award];
  }

  let extra = 0;
  for (const { player } of others) {
    result[player.id] ??= titles.extra[extra++ % titles.extra.length]!;
  }
  return result;
}
