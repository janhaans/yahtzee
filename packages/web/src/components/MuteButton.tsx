import { nl } from '../i18n/nl';
import { SpeakerIcon } from './Icons';

interface Props {
  muted: boolean;
  onChange: (muted: boolean) => void;
  /** 'round' is an icon button (game bar); 'labelled' also says whether sound is on. */
  variant?: 'round' | 'labelled';
}

/** The sound on/off button. Each device has its own. */
export function MuteButton({ muted, onChange, variant = 'round' }: Props) {
  if (variant === 'labelled') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={!muted}
        aria-label={nl.sound.label}
        className="button sound-switch"
        onClick={() => onChange(!muted)}
      >
        <SpeakerIcon on={!muted} />
        <span>{muted ? nl.sound.off : nl.sound.on}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className="button round"
      aria-label={muted ? nl.sound.turnOn : nl.sound.turnOff}
      onClick={() => onChange(!muted)}
    >
      <SpeakerIcon on={!muted} />
    </button>
  );
}
