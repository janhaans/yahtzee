import { nl } from '../i18n/nl';
import { sound } from '../sound/engine';
import { useSoundLocked } from '../sound/useDeviceSound';

/**
 * A small reminder while the phone does not allow sound yet: before the first tap, and on an
 * iPhone again after the screen was locked or a call came in. Any tap starts the sound; this
 * button is just the obvious place to tap.
 */
export function SoundHint() {
  const locked = useSoundLocked();
  if (!locked) return null;
  return (
    <button type="button" className="sound-hint" onClick={() => sound.unlock()}>
      {nl.sound.tapToUnlock}
    </button>
  );
}
