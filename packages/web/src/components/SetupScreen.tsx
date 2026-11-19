import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS, nameKey } from '@yahtzee/game-logic';
import {
  AVATARS,
  COLOURS,
  isAvatar,
  isColour,
  type AvatarId,
  type Colour,
  type GameSetup,
  type NewPlayer,
  type ThemeId,
} from '@yahtzee/server/looks';
import type { RecentPlayer } from '../api';
import { avatarEmoji, defaultAvatar, freeColour } from '../avatars';
import { nl } from '../i18n/nl';
import { reducedMotion } from '../motion';
import type { ClientResult } from '../useGame';
import { Dialog } from './Dialog';

interface Props {
  onStart: (setup: GameSetup) => Promise<ClientResult>;
  onBack: () => void;
  theme: ThemeId;
  /** Players from earlier games, most recent first, for quick setup. */
  recentPlayers?: readonly RecentPlayer[];
}

const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

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

function newRow(theme: ThemeId, seat: number, taken: readonly string[]): NewPlayer {
  return { name: '', avatar: defaultAvatar(theme, seat), colour: freeColour(taken) };
}

export function SetupScreen({ onStart, onBack, theme, recentPlayers = [] }: Props) {
  const [rows, setRows] = useState<NewPlayer[]>(() => {
    const first = newRow(theme, 0, []);
    return [first, newRow(theme, 1, [first.colour])];
  });
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const shuffleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(shuffleTimer.current), []);

  const setCount = (count: number) =>
    setRows((current) => {
      const next = current.slice(0, count);
      while (next.length < count) {
        next.push(
          newRow(
            theme,
            next.length,
            next.map((r) => r.colour),
          ),
        );
      }
      return next;
    });

  const update = (index: number, change: Partial<NewPlayer>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  // Suggest names nobody has typed yet; tapping one fills the first empty field.
  const taken = new Set(rows.map((row) => nameKey(row.name)));
  const suggestions = recentPlayers.filter((player) => !taken.has(nameKey(player.name)));
  const firstEmpty = rows.findIndex((row) => nameKey(row.name) === '');

  const addRecent = (player: RecentPlayer) => {
    const others = rows.filter((_, i) => i !== firstEmpty).map((row) => row.colour);
    // Bring back their last avatar and colour, if those can still be used.
    update(firstEmpty, {
      name: player.name,
      ...(isAvatar(player.avatar) && { avatar: player.avatar }),
      ...(isColour(player.colour) && !others.includes(player.colour) && { colour: player.colour }),
    });
  };

  const whoStarts = () => {
    if (reducedMotion()) {
      setRows(shuffled);
      return;
    }
    setShuffling(true);
    clearTimeout(shuffleTimer.current);
    shuffleTimer.current = setTimeout(() => {
      setRows(shuffled);
      setShuffling(false);
    }, SHUFFLE_MS);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // The server checks everything again; this answer only shows the friendly message.
    const result = await onStart({ players: rows, theme });
    if (!result.ok) setError(nl.errors[result.error]);
  };

  return (
    <main className="screen setup-screen">
      <h1>{nl.setup.title}</h1>
      <form onSubmit={submit}>
        <fieldset className="count-picker">
          <legend>{nl.setup.playerCount}</legend>
          {COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              className={rows.length === count ? 'button selected' : 'button'}
              aria-pressed={rows.length === count}
              onClick={() => setCount(count)}
            >
              {count}
            </button>
          ))}
        </fieldset>

        <ol className={shuffling ? 'name-list shuffling' : 'name-list'}>
          {rows.map((row, i) => (
            <li key={i} className="player-row" style={{ borderColor: row.colour }}>
              <button
                type="button"
                className="avatar-button"
                style={{ backgroundColor: row.colour }}
                aria-label={`${nl.setup.chooseAvatar(i + 1)}: ${nl.avatars[row.avatar]}`}
                onClick={() => setPicking(i)}
              >
                {avatarEmoji(row.avatar)}
              </button>
              <label>
                <span>{nl.setup.playerLabel(i + 1)}</span>
                <input
                  value={row.name}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder={nl.setup.namePlaceholder}
                  autoComplete="off"
                  onChange={(event) => update(i, { name: event.target.value })}
                />
              </label>
              <ColourPicker
                seat={i}
                value={row.colour}
                taken={rows.filter((_, j) => j !== i).map((r) => r.colour)}
                onPick={(colour) => update(i, { colour })}
              />
            </li>
          ))}
        </ol>

        {suggestions.length > 0 && firstEmpty !== -1 && (
          <div className="recent-names">
            <span className="hint">{nl.setup.recent}</span>
            {suggestions.map((player) => (
              <button
                key={player.name}
                type="button"
                className="button chip"
                aria-label={nl.setup.addRecent(player.name)}
                onClick={() => addRecent(player)}
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

        <div className="row">
          <button type="button" className="button" onClick={onBack}>
            {nl.setup.back}
          </button>
          <button type="button" className="button" disabled={shuffling} onClick={whoStarts}>
            🎲 {nl.setup.whoStarts}
          </button>
          <button type="submit" className="button big" disabled={shuffling}>
            {nl.setup.start}
          </button>
        </div>
      </form>

      {picking !== null && (
        <AvatarDialog
          seat={picking}
          value={rows[picking]!.avatar}
          onPick={(avatar) => {
            update(picking, { avatar });
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </main>
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
            style={{ backgroundColor: colour }}
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
