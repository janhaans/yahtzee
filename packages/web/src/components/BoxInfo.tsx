import type { BoxId } from '@yahtzee/game-logic';
import { nl } from '../i18n/nl';
import { Dialog } from './Dialog';

/** The small grey (i) circle, inside a 48 x 48 px tap area. */
export function InfoButton({ box, onOpen }: { box: BoxId; onOpen: (box: BoxId) => void }) {
  return (
    <button
      type="button"
      className="info-button"
      aria-label={nl.game.info(nl.boxes[box])}
      onClick={() => onOpen(box)}
    >
      <span className="info-dot" aria-hidden="true">
        i
      </span>
    </button>
  );
}

/** One-line explanation and an example for a box. */
export function BoxInfoDialog({ box, onClose }: { box: BoxId; onClose: () => void }) {
  return (
    <Dialog
      title={nl.boxes[box]}
      onClose={onClose}
      actions={
        <button type="button" className="button" onClick={onClose}>
          {nl.confirm.close}
        </button>
      }
    >
      <p>{nl.boxInfo[box].text}</p>
      <p className="example">{nl.boxInfo[box].example}</p>
    </Dialog>
  );
}
