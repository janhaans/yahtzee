import { nl } from '../i18n/nl';

interface Props {
  muted: boolean;
  onChange: (muted: boolean) => void;
}

/** The big sound on/off button. Each device has its own. */
export function MuteButton({ muted, onChange }: Props) {
  return (
    <button
      type="button"
      className="button mute-button"
      aria-label={muted ? nl.sound.turnOn : nl.sound.turnOff}
      onClick={() => onChange(!muted)}
    >
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
    </button>
  );
}
