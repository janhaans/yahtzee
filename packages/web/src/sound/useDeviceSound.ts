import { useEffect } from 'react';
import { sound } from './engine';

/** Applies this device's mute setting, and unlocks sound on the first tap or key press. */
export function useDeviceSound(muted: boolean): void {
  useEffect(() => sound.setMuted(muted), [muted]);
  // Browsers only allow sound after a tap, so every tap or key press unlocks it.
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, []);
}
