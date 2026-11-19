import { useState, type ReactNode } from 'react';
import {
  LOWER_BOXES,
  UPPER_BOXES,
  previewScores,
  totals,
  type BoxId,
  type Dice,
  type Player,
  type Scorecard,
} from '@yahtzee/game-logic';
import { avatarEmoji } from '../avatars';
import { nl } from '../i18n/nl';
import { Dialog } from './Dialog';

interface Props {
  players: readonly Player[];
  scorecards: readonly Scorecard[];
  /** When set, the (only) column is the current player's and empty boxes can be chosen. */
  choose?: { dice: Dice | null; onChoose: (box: BoxId, points: number) => void };
  winnerIds?: readonly string[];
}

/** Scorecard for one or more players, with point previews for the current player. */
export function ScoreTable({ players, scorecards, choose, winnerIds = [] }: Props) {
  const [infoBox, setInfoBox] = useState<BoxId | null>(null);
  const preview = choose?.dice && scorecards[0] ? previewScores(choose.dice, scorecards[0]) : {};
  const allTotals = scorecards.map(totals);

  const boxRow = (box: BoxId) => (
    <tr key={box}>
      <th scope="row">
        <span className="box-name">{nl.boxes[box]}</span>
        <button
          type="button"
          className="info-button"
          aria-label={nl.game.info(nl.boxes[box])}
          onClick={() => setInfoBox(box)}
        >
          i
        </button>
      </th>
      {scorecards.map((card, i) => (
        <td key={players[i]!.id}>{cell(card.boxes[box], box)}</td>
      ))}
    </tr>
  );

  const cell = (value: number | null, box: BoxId): ReactNode => {
    if (value !== null) return <span className="filled">{value}</span>;
    if (!choose) return null;
    const points = preview[box];
    return (
      <button
        type="button"
        className={points === 0 ? 'choose scratch' : 'choose'}
        disabled={points === undefined}
        aria-label={`${nl.boxes[box]}${points === undefined ? '' : `: ${points}`}`}
        onClick={() => points !== undefined && choose.onChoose(box, points)}
      >
        {points ?? ''}
      </button>
    );
  };

  const totalRow = (label: ReactNode, value: (i: number) => ReactNode, className = 'total') => (
    <tr className={className}>
      <th scope="row">{label}</th>
      {players.map((player, i) => (
        <td key={player.id}>{value(i)}</td>
      ))}
    </tr>
  );

  return (
    <>
      <table className="score-table">
        <thead>
          <tr>
            <th scope="col">{nl.scorecard.box}</th>
            {players.map((player) => (
              <th
                key={player.id}
                scope="col"
                style={{ color: player.colour }}
                className={winnerIds.includes(player.id) ? 'winner' : undefined}
              >
                {avatarEmoji(player.avatar)} {player.name}
                {winnerIds.includes(player.id) && ' 🏆'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UPPER_BOXES.map(boxRow)}
          {totalRow(nl.scorecard.upperTotal, (i) => allTotals[i]!.upperTotal)}
          {totalRow(nl.scorecard.upperBonus, (i) =>
            allTotals[i]!.upperBonus > 0 ? (
              allTotals[i]!.upperBonus
            ) : (
              <span className="progress">
                {nl.scorecard.bonusProgress(allTotals[i]!.upperTotal)}
              </span>
            ),
          )}
          {LOWER_BOXES.map(boxRow)}
          {totalRow(nl.scorecard.lowerTotal, (i) => allTotals[i]!.lowerTotal)}
          {totalRow(nl.scorecard.yahtzeeBonus, (i) => allTotals[i]!.yahtzeeBonus)}
          {totalRow(nl.scorecard.grandTotal, (i) => allTotals[i]!.grandTotal, 'grand-total')}
        </tbody>
      </table>

      {infoBox && (
        <Dialog
          title={nl.boxes[infoBox]}
          onClose={() => setInfoBox(null)}
          actions={
            <button type="button" className="button" onClick={() => setInfoBox(null)}>
              {nl.confirm.close}
            </button>
          }
        >
          <p>{nl.boxInfo[infoBox].text}</p>
          <p className="example">{nl.boxInfo[infoBox].example}</p>
        </Dialog>
      )}
    </>
  );
}
