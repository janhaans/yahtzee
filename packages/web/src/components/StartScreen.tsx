import { THEMES as THEME_IDS, type ThemeId } from '@yahtzee/server/looks';
import { nl } from '../i18n/nl';
import { THEMES } from '../themes';

interface Props {
  theme: ThemeId;
  onTheme: (theme: ThemeId) => void;
  onNewGame: () => void;
}

export function StartScreen({ theme, onTheme, onNewGame }: Props) {
  return (
    <main className="screen start-screen">
      <h1 className="logo">{nl.appName}</h1>
      <p className="tagline">{nl.themes[theme].tagline}</p>

      <fieldset className="theme-picker">
        <legend>{nl.start.chooseTheme}</legend>
        {THEME_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="theme-card"
            data-theme-card={id}
            aria-pressed={id === theme}
            onClick={() => onTheme(id)}
          >
            <span className="theme-emoji" aria-hidden="true">
              {THEMES[id].emoji}
            </span>
            <span className="theme-name">{nl.themes[id].name}</span>
          </button>
        ))}
      </fieldset>

      <button type="button" className="button big" onClick={onNewGame}>
        {nl.start.newGame}
      </button>
    </main>
  );
}
