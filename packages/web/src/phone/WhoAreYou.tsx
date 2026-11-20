import { useState } from 'react';
import type { GameState } from '@yahtzee/game-logic';
import type { SeatInfo } from '@yahtzee/server/protocol';
import { avatarEmoji } from '../avatars';
import { nl } from '../i18n/nl';
import type { ClientSeatResult } from '../useGame';

interface Props {
  state: GameState;
  seats: readonly SeatInfo[];
  onClaim: (playerId: string) => Promise<ClientSeatResult>;
}

/**
 * "Wie ben jij?": a phone that is not (or no longer) in the running game, for example after
 * scanning the QR code again, takes over a player. That can be a laptop player, or a phone
 * player whose phone is gone; never someone who is still playing on another phone.
 */
export function WhoAreYou({ state, seats, onClaim }: Props) {
  const [error, setError] = useState<string | null>(null);
  const claim = async (playerId: string) => {
    const result = await onClaim(playerId);
    if (!result.ok) setError(nl.errors[result.error]);
  };

  return (
    <section className="card phone-card who-are-you">
      <h1>{nl.phone.whoTitle}</h1>
      <p className="hint">{nl.phone.whoHint}</p>
      <ul className="lobby-list">
        {state.players.map((p, i) => {
          const seat = seats[i];
          const busy = seat?.controller === 'phone' && seat.online;
          return (
            <li key={p.id}>
              <button
                type="button"
                className="claim-button"
                disabled={busy}
                onClick={() => claim(p.id)}
              >
                <span
                  className="avatar-circle"
                  style={{ backgroundColor: p.colour }}
                  aria-hidden="true"
                >
                  {avatarEmoji(p.avatar)}
                </span>
                <span className="name">{p.name}</span>
                <span className="where">
                  {busy
                    ? nl.phone.onOtherPhone
                    : seat?.controller === 'phone'
                      ? nl.phone.phoneGone
                      : nl.phone.onLaptop}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="hint">{nl.phone.justWatching}</p>
    </section>
  );
}
