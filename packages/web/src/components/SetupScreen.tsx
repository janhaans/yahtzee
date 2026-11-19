import { useState, type FormEvent } from 'react';
import { MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS } from '@yahtzee/game-logic';
import { nl } from '../i18n/nl';
import type { ClientResult } from '../useGame';

interface Props {
  onStart: (names: string[]) => Promise<ClientResult>;
  onBack: () => void;
}

const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function SetupScreen({ onStart, onBack }: Props) {
  const [names, setNames] = useState<string[]>(['', '']);
  const [error, setError] = useState<string | null>(null);

  const setCount = (count: number) =>
    setNames((current) => Array.from({ length: count }, (_, i) => current[i] ?? ''));

  const setName = (index: number, name: string) =>
    setNames((current) => current.map((n, i) => (i === index ? name : n)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // The server checks the names again; this answer only shows the friendly message.
    const result = await onStart(names);
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
              className={names.length === count ? 'button selected' : 'button'}
              aria-pressed={names.length === count}
              onClick={() => setCount(count)}
            >
              {count}
            </button>
          ))}
        </fieldset>

        <ol className="name-list">
          {names.map((name, i) => (
            <li key={i}>
              <label>
                <span>{nl.setup.playerLabel(i + 1)}</span>
                <input
                  value={name}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder={nl.setup.namePlaceholder}
                  autoComplete="off"
                  onChange={(event) => setName(i, event.target.value)}
                />
              </label>
            </li>
          ))}
        </ol>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="row">
          <button type="button" className="button" onClick={onBack}>
            {nl.setup.back}
          </button>
          <button type="button" className="button" onClick={() => setNames(shuffled)}>
            🎲 {nl.setup.whoStarts}
          </button>
          <button type="submit" className="button big">
            {nl.setup.start}
          </button>
        </div>
      </form>
    </main>
  );
}
