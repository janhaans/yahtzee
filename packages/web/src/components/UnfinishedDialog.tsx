import { ROUNDS } from '@yahtzee/game-logic';
import type { UnfinishedGame } from '@yahtzee/server/protocol';
import { avatarEmoji } from '../avatars';
import { formatDateTime } from '../format';
import { nl } from '../i18n/nl';
import { Dialog } from './Dialog';

interface Props {
  game: UnfinishedGame;
  onContinue: () => void;
  onStop: () => void;
}

/** Asked on start-up when the last game was never finished. A choice is required. */
export function UnfinishedDialog({ game, onContinue, onStop }: Props) {
  return (
    <Dialog
      title={nl.unfinished.title}
      onClose={() => {}}
      actions={
        <>
          <button type="button" className="button" onClick={onStop}>
            {nl.unfinished.stop}
          </button>
          <button type="button" className="button big" onClick={onContinue}>
            {nl.unfinished.continue}
          </button>
        </>
      }
    >
      <ul className="unfinished-players">
        {game.players.map((player) => (
          <li key={player.id}>
            <span className="avatar-circle" style={{ backgroundColor: player.colour }}>
              {avatarEmoji(player.avatar)}
            </span>
            {player.name}
          </li>
        ))}
      </ul>
      <p>{nl.unfinished.round(game.round, ROUNDS)}</p>
      <p className="hint">{nl.unfinished.startedAt(formatDateTime(game.startedAt))}</p>
      <p className="hint">{nl.unfinished.stopNote}</p>
    </Dialog>
  );
}
