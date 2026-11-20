import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS, nameKey } from '@yahtzee/game-logic';
import {
  AVATARS,
  COLOURS,
  isAvatar,
  isColour,
  type AvatarId,
  type Colour,
} from '@yahtzee/server/looks';
import type { LobbyChange, LobbyPlayer, LobbyState } from '@yahtzee/server/protocol';
import type { RecentPlayer } from '../api';
import { avatarEmoji } from '../avatars';
import { nl } from '../i18n/nl';
import { reducedMotion } from '../motion';
import type { ClientResult, LobbyActions } from '../useGame';
import { Dialog } from './Dialog';
import { BackIcon } from './Icons';
import { JoinPanel } from './JoinPanel';

interface Props {
  /** The new game as the server has it; phones join it by themselves. */
  lobby: LobbyState;
  actions: Pick<LobbyActions, 'add' | 'update' | 'remove' | 'reorder' | 'start'>;
  onBack: () => void;
  /** Players from earlier games, most recent first, for quick setup. */
  recentPlayers?: readonly RecentPlayer[];
}

/** How long the "Wie begint?" shuffle wiggles before the new order shows. */
const SHUFFLE_MS = 800;

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function SetupScreen({ lobby, actions, onBack, recentPlayers = [] }: Props) {
  const { theme, players: rows } = lobby;
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const shuffleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(shuffleTimer.current), []);

  // The server checks everything; its answer only decides which friendly message shows.
  const run = async (action: () => Promise<ClientResult>) => {
    const result = await action();
    setError(result.ok ? null : nl.errors[result.error]);
  };
  const update = (row: LobbyPlayer, change: LobbyChange) =>
    run(() => actions.update(row.id, change));

  // Suggest names nobody has typed yet; tapping one fills the first empty laptop player.
  const taken = new Set(rows.map((row) => nameKey(row.name)));
  const suggestions = recentPlayers.filter((player) => !taken.has(nameKey(player.name)));
  const firstEmpty = rows.find((row) => row.controller === 'table' && nameKey(row.name) === '');

  const addRecent = (row: LobbyPlayer, player: RecentPlayer) => {
    const others = rows.filter((r) => r !== row).map((r) => r.colour);
    // Bring back their last avatar and colour, if those can still be used.
    void update(row, {
      name: player.name,
      ...(isAvatar(player.avatar) && { avatar: player.avatar }),
      ...(isColour(player.colour) && !others.includes(player.colour) && { colour: player.colour }),
    });
  };

  const whoStarts = () => {
    const reorder = () => run(() => actions.reorder(shuffled(rows.map((row) => row.id))));
    if (reducedMotion()) {
      void reorder();
      return;
    }
    setShuffling(true);
    clearTimeout(shuffleTimer.current);
    shuffleTimer.current = setTimeout(() => {
      void reorder();
      setShuffling(false);
    }, SHUFFLE_MS);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(actions.start);
  };

  const pickingRow = rows.find((row) => row.id === picking);

  return (
    <main className="screen setup-screen">
      <header className="setup-header">
        <button type="button" className="button round" aria-label={nl.setup.back} onClick={onBack}>
          <BackIcon />
        </button>
        <div>
          <h1>{nl.setup.title}</h1>
          <p className="hint">{nl.setup.subtitle(nl.themes[theme].name)}</p>
        </div>
      </header>

      <div className="setup-body">
        <form className="card setup-card" onSubmit={submit}>
          <ol className={shuffling ? 'name-list shuffling' : 'name-list'}>
            {rows.map((row, i) =>
              row.controller === 'phone' ? (
                <li key={row.id} className="player-row phone-player">
                  <span
                    className="avatar-button"
                    style={{ backgroundColor: row.colour }}
                    aria-hidden="true"
                  >
                    {avatarEmoji(row.avatar)}
                  </span>
                  <span className="name-field">
                    <span>{nl.setup.playerLabel(i + 1)}</span>
                    <strong className="phone-name">{row.name}</strong>
                  </span>
                  <span className={row.online ? 'phone-badge' : 'phone-badge offline'}>
                    {row.online ? nl.setup.onPhone : nl.setup.phoneOffline}
                  </span>
                  <button
                    type="button"
                    className="button round soft remove-player"
                    aria-label={nl.setup.removePlayer(i + 1)}
                    onClick={() => run(() => actions.remove(row.id))}
                  >
                    ✕
                  </button>
                </li>
              ) : (
                <li key={row.id} className="player-row">
                  <button
                    type="button"
                    className="avatar-button"
                    style={{ backgroundColor: row.colour }}
                    aria-label={`${nl.setup.chooseAvatar(i + 1)}: ${nl.avatars[row.avatar]}`}
                    onClick={() => setPicking(row.id)}
                  >
                    {avatarEmoji(row.avatar)}
                  </button>
                  <label className="name-field">
                    <span>{nl.setup.playerLabel(i + 1)}</span>
                    <NameInput value={row.name} onChange={(name) => update(row, { name })} />
                  </label>
                  <ColourPicker
                    seat={i}
                    value={row.colour}
                    taken={rows.filter((r) => r !== row).map((r) => r.colour)}
                    onPick={(colour) => update(row, { colour })}
                  />
                  {rows.length > MIN_PLAYERS && (
                    <button
                      type="button"
                      className="button round soft remove-player"
                      aria-label={nl.setup.removePlayer(i + 1)}
                      onClick={() => run(() => actions.remove(row.id))}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ),
            )}
          </ol>

          {rows.length < MAX_PLAYERS && (
            <button type="button" className="add-player" onClick={() => run(actions.add)}>
              {nl.setup.addPlayer}
            </button>
          )}

          {suggestions.length > 0 && firstEmpty && (
            <div className="recent-names">
              <span className="hint">{nl.setup.recent}</span>
              {suggestions.map((player) => (
                <button
                  key={player.name}
                  type="button"
                  className="button soft chip"
                  aria-label={nl.setup.addRecent(player.name)}
                  onClick={() => addRecent(firstEmpty, player)}
                >
                  {avatarEmoji(player.avatar)} {player.name}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="setup-footer">
            <button type="button" className="button soft" disabled={shuffling} onClick={whoStarts}>
              {nl.setup.whoStarts}
            </button>
            <button type="submit" className="button big" disabled={shuffling}>
              {nl.setup.start[theme]}
            </button>
          </div>
        </form>
        <JoinPanel />
      </div>

      {pickingRow && (
        <AvatarDialog
          seat={rows.indexOf(pickingRow)}
          value={pickingRow.avatar}
          onPick={(avatar) => {
            void update(pickingRow, { avatar });
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </main>
  );
}

/**
 * A name field that keeps what is being typed while it has focus, so the round trip to the
 * server never moves the cursor. It follows the server again once it loses focus.
 */
function NameInput({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      value={draft ?? value}
      maxLength={MAX_NAME_LENGTH}
      placeholder={nl.setup.namePlaceholder}
      autoComplete="off"
      onFocus={() => setDraft(value)}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(event.target.value);
      }}
    />
  );
}

interface ColourPickerProps {
  seat: number;
  value: Colour;
  /** Colours of the other players; colours must be unique in a game. */
  taken: readonly string[];
  onPick: (colour: Colour) => void;
}

function ColourPicker({ seat, value, taken, onPick }: ColourPickerProps) {
  return (
    <div className="colour-picker" role="group" aria-label={nl.setup.colours(seat + 1)}>
      {COLOURS.map((colour) => {
        const isTaken = taken.includes(colour);
        const name = nl.colours[colour];
        return (
          <button
            key={colour}
            type="button"
            className="swatch"
            style={{ backgroundColor: colour, color: colour }}
            aria-pressed={colour === value}
            aria-label={isTaken ? nl.setup.colourTaken(name) : name}
            disabled={isTaken}
            onClick={() => onPick(colour)}
          />
        );
      })}
    </div>
  );
}

interface AvatarDialogProps {
  seat: number;
  value: AvatarId;
  onPick: (avatar: AvatarId) => void;
  onClose: () => void;
}

function AvatarDialog({ seat, value, onPick, onClose }: AvatarDialogProps) {
  return (
    <Dialog
      title={`${nl.setup.avatarTitle} (${nl.setup.playerLabel(seat + 1)})`}
      onClose={onClose}
      actions={
        <button type="button" className="button" onClick={onClose}>
          {nl.confirm.close}
        </button>
      }
    >
      <div className="avatar-grid">
        {AVATARS.map((avatar) => (
          <button
            key={avatar}
            type="button"
            className="avatar-choice"
            aria-pressed={avatar === value}
            aria-label={nl.avatars[avatar]}
            onClick={() => onPick(avatar)}
          >
            {avatarEmoji(avatar)}
          </button>
        ))}
      </div>
    </Dialog>
  );
}
