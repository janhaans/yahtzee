import { nl } from '../i18n/nl';

export function StartScreen({ onNewGame }: { onNewGame: () => void }) {
  return (
    <main className="screen start-screen">
      <h1 className="logo">{nl.appName}</h1>
      <p className="tagline">{nl.start.tagline}</p>
      <button type="button" className="button big" onClick={onNewGame}>
        {nl.start.newGame}
      </button>
    </main>
  );
}
