import { AVATARS, COLOURS, type AvatarId, type Colour } from '@yahtzee/server/looks';
import { avatarEmoji } from '../avatars';
import { nl } from '../i18n/nl';

interface ColourPickerProps {
  label: string;
  value: Colour;
  /** Colours of the other players; colours must be unique in a game. */
  taken: readonly string[];
  onPick: (colour: Colour) => void;
}

/** The colour swatches of one player; colours of others cannot be picked. */
export function ColourPicker({ label, value, taken, onPick }: ColourPickerProps) {
  return (
    <div className="colour-picker" role="group" aria-label={label}>
      {COLOURS.map((colour) => {
        const isTaken = taken.includes(colour);
        const name = nl.colours[colour];
        return (
          <button
            key={colour}
            type="button"
            className="swatch"
            style={{ backgroundColor: colour, color: colour }}
            aria-pressed={colour === value}
            aria-label={isTaken ? nl.setup.colourTaken(name) : name}
            disabled={isTaken}
            onClick={() => onPick(colour)}
          />
        );
      })}
    </div>
  );
}

/** All avatars to pick from; several players may have the same one. */
export function AvatarGrid({
  value,
  onPick,
}: {
  value: AvatarId;
  onPick: (avatar: AvatarId) => void;
}) {
  return (
    <div className="avatar-grid">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          className="avatar-choice"
          aria-pressed={avatar === value}
          aria-label={nl.avatars[avatar]}
          onClick={() => onPick(avatar)}
        >
          {avatarEmoji(avatar)}
        </button>
      ))}
    </div>
  );
}
