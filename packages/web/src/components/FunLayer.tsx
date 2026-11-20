import { useEffect, useMemo, useState } from 'react';
import type { GameState } from '@yahtzee/game-logic';
import type { ThemeId } from '@yahtzee/server/looks';
import { avatarEmoji } from '../avatars';
import { MessagePicker, messageKind } from '../fun/messages';
import { soundsFor } from '../fun/sounds';
import { nl } from '../i18n/nl';
import { reducedMotion } from '../motion';
import { sound } from '../sound/engine';
import { useGameEvents } from '../useGameEvents';

const BANNER_MS = 1600;
const MESSAGE_MS = 3200;

interface Props {
  state: GameState | null | undefined;
  theme: ThemeId;
}

/** Banners and funny messages on top of the game. They never block for long: tap to skip. */
export function FunLayer({ state, theme }: Props) {
  const picker = useMemo(() => new MessagePicker(), []);
  const [banner, setBanner] = useState<{ seat: number; id: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);

  useGameEvents(state, (events) => {
    for (const event of events) {
      for (const name of soundsFor(event)) sound.play(name, theme);
      if (event.kind === 'turn' && !reducedMotion()) {
        setBanner({ seat: event.seat, id: Date.now() });
      } else if (event.kind === 'scored') {
        setMessage({ text: picker.pick(theme, messageKind(event)), id: Date.now() });
      } else if (event.kind === 'rolled' && event.yahtzee) {
        setMessage({ text: picker.pick(theme, 'yahtzee'), id: Date.now() });
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

  return (
    <>
      <div className="fun-message" role="status" aria-live="polite">
        {message && (
          <p key={message.id} className="bubble">
            {message.text}
          </p>
        )}
      </div>
      {player && (
        <div key={banner.id} className="turn-overlay" onClick={() => setBanner(null)}>
          <div className="turn-card" style={{ backgroundColor: player.colour }}>
            <span className="turn-avatar" aria-hidden="true">
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
