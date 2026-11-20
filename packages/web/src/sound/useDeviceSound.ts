import { useEffect, useSyncExternalStore } from 'react';
import { sound } from './engine';

/**
 * Taps that let a page start sound. A finger only counts when it lets go (pointerup,
 * touchend, click); pointerdown only counts for a mouse. That is why sound worked on the
 * laptop but not on an iPhone when only pointerdown was used.
 */
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

/** Applies this device's mute setting, and unlocks sound on every tap or key press. */
export function useDeviceSound(muted: boolean): void {
  useEffect(() => sound.setMuted(muted), [muted]);
  useEffect(() => {
    const unlock = () => sound.unlock();
    for (const event of GESTURES) window.addEventListener(event, unlock, true);
    return () => {
      for (const event of GESTURES) window.removeEventListener(event, unlock, true);
    };
  }, []);
}

/** True while the browser does not allow sound yet (before a tap, or after iOS stopped it). */
export function useSoundLocked(): boolean {
  return useSyncExternalStore(
    (listener) => sound.subscribe(listener),
    () => sound.locked,
  );
}
