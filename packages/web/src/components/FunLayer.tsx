import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from '@yahtzee/game-logic';
import type { ThemeId } from '@yahtzee/server/looks';
import { YahtzeeCelebration } from '../celebrate/YahtzeeCelebration';
import { MessagePicker, messageKind } from '../fun/messages';
import { soundsFor } from '../fun/sounds';
import { reducedMotion } from '../motion';
import { sound } from '../sound/engine';
import { useGameEvents } from '../useGameEvents';

const MESSAGE_MS = 3200;
/** A Yahtzee is celebrated once the dice have landed (they take at most 1 second). */
export const DICE_LAND_MS = 900;

interface Props {
  state: GameState | null | undefined;
  theme: ThemeId;
}

/**
 * Sounds, funny messages and the Yahtzee celebration. A turn change only plays a sound here;
 * the game screen shows it quietly (ring in the top bar, heading on the dice table).
 */
export function FunLayer({ state, theme }: Props) {
  const picker = useMemo(() => new MessagePicker(), []);
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const yahtzeeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(yahtzeeTimer.current), []);
  const endCelebration = useCallback(() => setCelebrating(false), []);

  useGameEvents(state, (events) => {
    for (const event of events) {
      if (event.kind === 'rolled') {
        if (!event.yahtzee) continue;
        // Wait for the dice to land, then party.
        clearTimeout(yahtzeeTimer.current);
        yahtzeeTimer.current = setTimeout(
          () => {
            for (const name of soundsFor(event)) sound.play(name, theme);
            setCelebrating(true);
          },
          reducedMotion() ? 0 : DICE_LAND_MS,
        );
        continue;
      }
      for (const name of soundsFor(event)) sound.play(name, theme);
      if (event.kind === 'scored') {
        setMessage({ text: picker.pick(theme, messageKind(event)), id: Date.now() });
      }
    }
  });

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const slot = document.getElementById('message-slot');
  const messageBox = (
    <div className={slot ? 'fun-message in-table' : 'fun-message'} role="status" aria-live="polite">
      {message && (
        <p key={message.id} className="bubble">
          {message.text}
        </p>
      )}
    </div>
  );

  return (
    <>
      {celebrating && <YahtzeeCelebration theme={theme} onDone={endCelebration} />}
      {/* On the game screen the message sits on the dice table; elsewhere at the bottom. */}
      {slot ? createPortal(messageBox, slot) : messageBox}
    </>
  );
}
