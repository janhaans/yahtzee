import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from '@yahtzee/game-logic';
import type { ThemeId } from '@yahtzee/server/looks';
import { avatarEmoji } from '../avatars';
import { YahtzeeCelebration } from '../celebrate/YahtzeeCelebration';
import { MessagePicker, messageKind } from '../fun/messages';
import { soundsFor } from '../fun/sounds';
import { nl } from '../i18n/nl';
import { reducedMotion } from '../motion';
import { sound } from '../sound/engine';
import { useGameEvents } from '../useGameEvents';

const BANNER_MS = 1600;
const MESSAGE_MS = 3200;
/** A Yahtzee is celebrated once the dice have landed (they take at most 1 second). */
export const DICE_LAND_MS = 900;

interface Props {
  state: GameState | null | undefined;
  theme: ThemeId;
}

/** Banners and funny messages on top of the game. They never block for long: tap to skip. */
export function FunLayer({ state, theme }: Props) {
  const picker = useMemo(() => new MessagePicker(), []);
  const [banner, setBanner] = useState<{ seat: number; id: number } | null>(null);
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
      if (event.kind === 'turn' && !reducedMotion()) {
        setBanner({ seat: event.seat, id: Date.now() });
      } else if (event.kind === 'scored') {
        setMessage({ text: picker.pick(theme, messageKind(event)), id: Date.now() });
      }
    }
  });

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const player = banner && state?.players[banner.seat];
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
      {/* On the game screen the message sits on the dice table; elsewhere at the top. */}
      {slot ? createPortal(messageBox, slot) : messageBox}
      {player && (
        <div key={banner.id} className="turn-overlay" onClick={() => setBanner(null)}>
          <div className="turn-card">
            <span
              className="turn-avatar avatar-circle"
              style={{ backgroundColor: player.colour }}
              aria-hidden="true"
            >
              {avatarEmoji(player.avatar)}
            </span>
            <span className="turn-name">{nl.game.turn(player.name)}</span>
            <span className="turn-cheer">{nl.turnCheer[theme]}</span>
          </div>
        </div>
      )}
    </>
  );
}
