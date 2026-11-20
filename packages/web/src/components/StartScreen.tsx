import { THEMES as THEME_IDS, type ThemeId } from '@yahtzee/server/looks';
import { nl } from '../i18n/nl';
import { MuteButton } from './MuteButton';

interface Props {
  theme: ThemeId;
  onTheme: (theme: ThemeId) => void;
  muted?: boolean;
  onMute?: (muted: boolean) => void;
  onNewGame: () => void;
}

export function StartScreen({
  theme,
  onTheme,
  muted = false,
  onMute = () => {},
  onNewGame,
}: Props) {
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
              {id === 'voetbal' ? '⚽' : '🍭'}
            </span>
            <span className="theme-name">{nl.themes[id].name}</span>
          </button>
        ))}
      </fieldset>

      <div className="row">
        <button type="button" className="button big" onClick={onNewGame}>
          {nl.start.newGame}
        </button>
        <MuteButton muted={muted} onChange={onMute} />
      </div>
    </main>
  );
}
