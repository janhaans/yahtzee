import { scores, winners, type GameState } from '@yahtzee/game-logic';
import { avatarEmoji } from '../avatars';
import { nl } from '../i18n/nl';
import { ScoreTable } from './ScoreTable';

interface Props {
  state: GameState;
  onRematch: () => void;
  onNewGame: () => void;
}

export function EndScreen({ state, onRematch, onNewGame }: Props) {
  const winnerIds = winners(state);
  const winnerNames = state.players.filter((p) => winnerIds.includes(p.id)).map((p) => p.name);
  const all = scores(state);
  const ranking = state.players
    .map((player, i) => ({ player, score: all[i]! }))
    .sort((a, b) => b.score - a.score);

  const headline =
    winnerNames.length === 1
      ? nl.end.winner(winnerNames[0]!)
      : nl.end.tie(`${winnerNames.slice(0, -1).join(', ')} ${nl.end.and} ${winnerNames.at(-1)}`);

  return (
    <main className="screen end-screen">
      <h1>{nl.end.title}</h1>
      <h2 className="winner-headline">🏆 {headline}</h2>

      <ol className="ranking">
        {ranking.map(({ player, score }) => (
          <li key={player.id} style={{ borderColor: player.colour }}>
            <span className="avatar">{avatarEmoji(player.avatar)}</span>
            <span className="name">{player.name}</span>
            <span className="points">{nl.end.points(score)}</span>
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
