import { useState, type ReactNode } from 'react';
import {
  LOWER_BOXES,
  UPPER_BOXES,
  totals,
  type BoxId,
  type Player,
  type Scorecard,
} from '@yahtzee/game-logic';
import { avatarEmoji } from '../avatars';
import { nl } from '../i18n/nl';
import { BoxInfoDialog, InfoButton } from './BoxInfo';

interface Props {
  players: readonly Player[];
  scorecards: readonly Scorecard[];
  winnerIds?: readonly string[];
}

/** The full scorecards of all players side by side, for the end of a game. */
export function ScoreTable({ players, scorecards, winnerIds = [] }: Props) {
  const [infoBox, setInfoBox] = useState<BoxId | null>(null);
  const allTotals = scorecards.map(totals);

  const boxRow = (box: BoxId) => (
    <tr key={box}>
      <th scope="row">
        <span className="box-name">{nl.boxes[box]}</span>
        <InfoButton box={box} onOpen={setInfoBox} />
      </th>
      {scorecards.map((card, i) => (
        <td key={players[i]!.id}>
          {card.boxes[box] !== null && <span className="filled">{card.boxes[box]}</span>}
        </td>
      ))}
    </tr>
  );

  const totalRow = (
    key: string,
    label: ReactNode,
    value: (i: number) => ReactNode,
    className = 'total',
  ) => (
    <tr key={key} className={className}>
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
                className={winnerIds.includes(player.id) ? 'winner' : undefined}
              >
                <span className="player-head">
                  <span className="avatar-circle" style={{ backgroundColor: player.colour }}>
                    {avatarEmoji(player.avatar)}
                  </span>
                  {player.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UPPER_BOXES.map(boxRow)}
          {totalRow('upperTotal', nl.scorecard.upperTotal, (i) => allTotals[i]!.upperTotal)}
          {totalRow('upperBonus', nl.scorecard.upperBonus, (i) => allTotals[i]!.upperBonus)}
          {LOWER_BOXES.map(boxRow)}
          {totalRow('lowerTotal', nl.scorecard.lowerTotal, (i) => allTotals[i]!.lowerTotal)}
          {totalRow('yahtzeeBonus', nl.scorecard.yahtzeeBonus, (i) => allTotals[i]!.yahtzeeBonus)}
          {totalRow(
            'grandTotal',
            nl.scorecard.grandTotal,
            (i) => allTotals[i]!.grandTotal,
            'grand-total',
          )}
        </tbody>
      </table>
      {infoBox && <BoxInfoDialog box={infoBox} onClose={() => setInfoBox(null)} />}
    </>
  );
}
