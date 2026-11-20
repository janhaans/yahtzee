import { useState, type FormEvent } from 'react';
import { MAX_NAME_LENGTH } from '@yahtzee/game-logic';
import { defaultAvatar, freeColour, type NewPlayer } from '@yahtzee/server/looks';
import type { LobbyState } from '@yahtzee/server/protocol';
import { AvatarGrid, ColourPicker } from '../components/Looks';
import { nl } from '../i18n/nl';
import { readProfile, writeProfile } from '../settings';
import type { ClientSeatResult } from '../useGame';

interface Props {
  lobby: LobbyState;
  onJoin: (player: NewPlayer) => Promise<ClientSeatResult>;
}

/**
 * Joining a new game on a phone: a name, an avatar and a colour nobody else has. The name
 * and looks of last time are filled in, so joining again is one tap.
 */
export function JoinForm({ lobby, onJoin }: Props) {
  const [profile] = useState(readProfile);
  const [name, setName] = useState(profile.name ?? '');
  const [avatar, setAvatar] = useState(profile.avatar ?? defaultAvatar(lobby.theme, 0));
  const [picked, setPicked] = useState(profile.colour);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Someone else may take a colour while this form is open; then another one is offered.
  const taken = lobby.players.map((p) => p.colour);
  const colour = picked && !taken.includes(picked) ? picked : freeColour(taken);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const player = { name, avatar, colour };
    const result = await onJoin(player);
    setBusy(false);
    if (result.ok) writeProfile(player);
    else setError(nl.errors[result.error]);
  };

  return (
    <form className="card phone-card join-form" onSubmit={submit}>
      <h1>{nl.phone.joinTitle}</h1>
      <label className="name-field">
        <span>{nl.phone.nameLabel}</span>
        <input
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder={nl.setup.namePlaceholder}
          autoComplete="given-name"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <section aria-label={nl.phone.avatarLabel}>
        <h2>{nl.phone.avatarLabel}</h2>
        <AvatarGrid value={avatar} onPick={setAvatar} />
      </section>
      <section>
        <h2>{nl.phone.colourLabel}</h2>
        <ColourPicker
          label={nl.phone.colourLabel}
          value={colour}
          taken={taken}
          onPick={setPicked}
        />
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button big" disabled={busy}>
        {nl.phone.join}
      </button>
    </form>
  );
}
