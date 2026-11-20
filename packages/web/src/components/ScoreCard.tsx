import { useState } from 'react';
import {
  LOWER_BOXES,
  UPPER_BONUS_THRESHOLD,
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
import { BoxInfoDialog, InfoButton } from './BoxInfo';

interface Props {
  player: Player;
  card: Scorecard;
  /** The dice on the table; null before the first roll. */
  dice: Dice | null;
  onChoose: (box: BoxId, points: number) => void;
}

/**
 * The scorecard of the player whose turn it is: every box with what it holds, or the points
 * it would give now. The box with the most points is highlighted.
 */
export function ScoreCard({ player, card, dice, onChoose }: Props) {
  const [infoBox, setInfoBox] = useState<BoxId | null>(null);
  const preview = dice ? previewScores(dice, card) : {};
  const sums = totals(card);
  const best = Math.max(0, ...Object.values(preview));
  const bestBox =
    best > 0 ? [...UPPER_BOXES, ...LOWER_BOXES].find((b) => preview[b] === best) : null;

  const row = (box: BoxId) => {
    const filled = card.boxes[box];
    const points = preview[box];
    const classes = ['score-row', filled !== null ? 'done' : '', box === bestBox ? 'best' : ''];
    return (
      <li key={box} className={classes.join(' ').trim()}>
        <span className="box-name">{nl.boxes[box]}</span>
        <InfoButton box={box} onOpen={setInfoBox} />
        {filled !== null ? (
          <span className="filled">{filled}</span>
        ) : (
          <button
            type="button"
            className={points === 0 ? 'choose scratch' : 'choose'}
            disabled={points === undefined}
            aria-label={`${nl.boxes[box]}${points === undefined ? '' : `: ${points}`}`}
            onClick={() => points !== undefined && onChoose(box, points)}
          >
            {points === undefined ? '' : points > 0 ? `+${points}` : '0'}
          </button>
        )}
      </li>
    );
  };

  return (
    <section className="card scorecard" aria-label={nl.scorecard.title(player.name)}>
      <header className="scorecard-head">
        <span className="avatar-circle" style={{ backgroundColor: player.colour }}>
          {avatarEmoji(player.avatar)}
        </span>
        <h2>{nl.scorecard.title(player.name)}</h2>
        {dice && <span className="hint">{nl.scorecard.tapToChoose}</span>}
      </header>

      <div className="scorecard-sections">
        <div className="score-section">
          <h3>{nl.scorecard.upper}</h3>
          <ul>{UPPER_BOXES.map(row)}</ul>
          <p className="score-sum">
            <span>{nl.scorecard.bonusAt(UPPER_BONUS_THRESHOLD)}</span>
            <span>
              {sums.upperBonus > 0
                ? `+${sums.upperBonus}`
                : nl.scorecard.bonusProgress(sums.upperTotal)}
            </span>
          </p>
        </div>
        <div className="score-section">
          <h3>{nl.scorecard.lower}</h3>
          <ul>{LOWER_BOXES.map(row)}</ul>
          {sums.yahtzeeBonus > 0 && (
            <p className="score-sum">
              <span>{nl.scorecard.yahtzeeBonus}</span>
              <span>+{sums.yahtzeeBonus}</span>
            </p>
          )}
        </div>
      </div>

      <p className="score-total">
        <span>{nl.scorecard.grandTotal}</span>
        <span>{sums.grandTotal}</span>
      </p>

      {infoBox && <BoxInfoDialog box={infoBox} onClose={() => setInfoBox(null)} />}
    </section>
  );
}
