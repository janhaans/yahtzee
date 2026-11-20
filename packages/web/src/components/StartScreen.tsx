import { THEMES as THEME_IDS, type ThemeId } from '@yahtzee/server/looks';
import { nl } from '../i18n/nl';
import { DieFace } from './Dice';
import { CheckIcon, Logo } from './Icons';
import { MuteButton } from './MuteButton';

interface Props {
  theme: ThemeId;
  onTheme: (theme: ThemeId) => void;
  muted?: boolean;
  onMute?: (muted: boolean) => void;
  onNewGame: () => void;
}

/** The die on each theme card. */
const CARD_DIE = { voetbal: 5, snoep: 3 } as const;

export function StartScreen({
  theme,
  onTheme,
  muted = false,
  onMute = () => {},
  onNewGame,
}: Props) {
  return (
    <main className="screen start-screen">
      <header className="start-bar">
        <span className="brand">
          <Logo />
          <span className="brand-text">{nl.appName}</span>
        </span>
        <MuteButton muted={muted} onChange={onMute} variant="labelled" />
      </header>

      <h1 className="logo">{nl.appName}</h1>
      <p className="tagline">{nl.start.tagline}</p>

      <fieldset className="theme-picker">
        <legend className="visually-hidden">{nl.start.chooseTheme}</legend>
        {THEME_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="theme-card"
            data-theme-card={id}
            aria-pressed={id === theme}
            onClick={() => onTheme(id)}
          >
            <span className="theme-art" aria-hidden="true">
              <span className="mini-die">
                <DieFace value={CARD_DIE[id]} />
              </span>
            </span>
            <span className="theme-text">
              <span className="theme-name">{nl.themes[id].name}</span>
              <span className="theme-description">{nl.themes[id].description}</span>
            </span>
            <span className="theme-check" aria-hidden="true">
              {id === theme && <CheckIcon size={20} />}
            </span>
          </button>
        ))}
      </fieldset>

      <button type="button" className="button big" onClick={onNewGame}>
        {nl.start.newGame}
      </button>
    </main>
  );
}
