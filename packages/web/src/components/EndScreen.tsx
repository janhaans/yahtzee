import { useEffect } from 'react';
import { scores, winners, type GameState } from '@yahtzee/game-logic';
import { DEFAULT_THEME, type ThemeId } from '@yahtzee/server/looks';
import { avatarEmoji } from '../avatars';
import { celebrateWinner, stopConfetti } from '../celebrate/confetti';
import { playerTitles } from '../fun/titles';
import { nl } from '../i18n/nl';
import { reducedMotion } from '../motion';
import { ScoreTable } from './ScoreTable';

interface Props {
  state: GameState;
  theme?: ThemeId;
  onRematch: () => void;
  onNewGame: () => void;
}

const TROPHIES: Record<number, string> = { 1: '🏆', 2: '🥈', 3: '🥉' };

/** Podium order on screen: 2nd on the left, 1st in the middle, then 3rd and 4th. */
const PODIUM_ORDER = [2, 1, 3, 4];

export function EndScreen({ state, theme = DEFAULT_THEME, onRematch, onNewGame }: Props) {
  const winnerIds = winners(state);
  const winnerNames = state.players.filter((p) => winnerIds.includes(p.id)).map((p) => p.name);
  const all = scores(state);
  const titles = playerTitles(state, theme);
  const ranking = state.players
    .map((player, i) => ({ player, score: all[i]! }))
    .sort((a, b) => b.score - a.score)
    // Equal scores share a place: 1, 1, 3, ...
    .map((entry, _, sorted) => ({
      ...entry,
      place: 1 + sorted.filter((other) => other.score > entry.score).length,
    }));

  useEffect(() => {
    if (reducedMotion()) return;
    const stop = celebrateWinner(theme);
    return () => {
      stop();
      stopConfetti();
    };
  }, [theme]);

  const headline =
    winnerNames.length === 1
      ? nl.end.winner(winnerNames[0]!)
      : nl.end.tie(`${winnerNames.slice(0, -1).join(', ')} ${nl.end.and} ${winnerNames.at(-1)}`);

  return (
    <main className="screen end-screen">
      <h1>{nl.end.title}</h1>
      <h2 className="winner-headline">🏆 {headline}</h2>

      <ol className="ranking podium">
        {ranking.map(({ player, score, place }, i) => (
          <li
            key={player.id}
            className={place === 1 ? 'winner' : undefined}
            style={{ order: PODIUM_ORDER[i], borderColor: player.colour }}
            aria-label={`${nl.end.place(place)}: ${player.name}, ${nl.end.points(score)}, ${titles[player.id]}`}
          >
            <span className="avatar" aria-hidden="true">
              {avatarEmoji(player.avatar)}
            </span>
            <span className="name">{player.name}</span>
            <span className="points">{nl.end.points(score)}</span>
            <span className="title">{titles[player.id]}</span>
            <span
              className={`step step-${place}`}
              style={{ backgroundColor: player.colour }}
              aria-hidden="true"
            >
              <span className="trophy">{TROPHIES[place] ?? ''}</span>
              <span className="place">{place}</span>
            </span>
          </li>
        ))}
      </ol>

      <ScoreTable players={state.players} scorecards={state.scorecards} winnerIds={winnerIds} />

      <div className="row">
        <button type="button" className="button big" onClick={onRematch}>
          {nl.end.rematch}
        </button>
        <button type="button" className="button" onClick={onNewGame}>
          {nl.end.newGame}
        </button>
      </div>
    </main>
  );
}
