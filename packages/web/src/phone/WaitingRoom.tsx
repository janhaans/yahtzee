import { useState } from 'react';
import type { LobbyChange, LobbyPlayer, LobbyState } from '@yahtzee/server/protocol';
import { avatarEmoji } from '../avatars';
import { AvatarGrid, ColourPicker } from '../components/Looks';
import { nl } from '../i18n/nl';
import type { ClientResult } from '../useGame';

interface Props {
  lobby: LobbyState;
  me: LobbyPlayer;
  onChange: (change: LobbyChange) => Promise<ClientResult>;
  onLeave: () => Promise<ClientResult>;
}

/** Joined: waiting until someone taps "Start" on the laptop. */
export function WaitingRoom({ lobby, me, onChange, onLeave }: Props) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<ClientResult>) => {
    const result = await action();
    setError(result.ok ? null : nl.errors[result.error]);
  };
  // Laptop players whose name is still being typed are not shown yet.
  const players = lobby.players.filter((p) => p.name.trim() !== '');

  return (
    <section className="card phone-card waiting-room">
      <span className="avatar-circle big" style={{ backgroundColor: me.colour }} aria-hidden="true">
        {avatarEmoji(me.avatar)}
      </span>
      <h1>{nl.phone.joined(me.name)}</h1>
      <p className="hint">{nl.phone.waitingForStart}</p>

      <h2>{nl.phone.players}</h2>
      <ul className="lobby-list">
        {players.map((p) => (
          <li key={p.id}>
            <span className="avatar-circle" style={{ backgroundColor: p.colour }}>
              {avatarEmoji(p.avatar)}
            </span>
            <span className="name">
              {p.name}
              {p.id === me.id && ` ${nl.phone.you}`}
            </span>
            <span className="where">{p.controller === 'phone' ? '📱' : '💻'}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {editing ? (
        <>
          <AvatarGrid value={me.avatar} onPick={(avatar) => run(() => onChange({ avatar }))} />
          <ColourPicker
            label={nl.phone.colourLabel}
            value={me.colour}
            taken={lobby.players.filter((p) => p.id !== me.id).map((p) => p.colour)}
            onPick={(colour) => run(() => onChange({ colour }))}
          />
          <button type="button" className="button" onClick={() => setEditing(false)}>
            {nl.phone.done}
          </button>
        </>
      ) : (
        <button type="button" className="button soft" onClick={() => setEditing(true)}>
          {nl.phone.changeLooks}
        </button>
      )}
      <button type="button" className="button link" onClick={() => run(onLeave)}>
        {nl.phone.leave}
      </button>
    </section>
  );
}
