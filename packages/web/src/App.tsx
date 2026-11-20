import { useEffect, useState } from 'react';
import { useRecentPlayers } from './api';
import { EndScreen } from './components/EndScreen';
import { FunLayer } from './components/FunLayer';
import { GameScreen } from './components/GameScreen';
import { SetupScreen } from './components/SetupScreen';
import { StartScreen } from './components/StartScreen';
import { UnfinishedDialog } from './components/UnfinishedDialog';
import { nl } from './i18n/nl';
import { useMuted, useThemePreference } from './settings';
import { sound } from './sound/engine';
import { useGame } from './useGame';

/** The game table on the laptop (route `/`). */
export function App() {
  const { state, theme: gameTheme, connected, unfinished, saveFailed, actions } = useGame();
  const [preferredTheme, setPreferredTheme] = useThemePreference();
  const [muted, setMuted] = useMuted();

  useEffect(() => sound.setMuted(muted), [muted]);
  // Browsers only allow sound after a tap, so every tap or key press unlocks it.
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, []);
  const [view, setView] = useState<'start' | 'setup'>('start');
  const recentPlayers = useRecentPlayers(view === 'setup');
  const status = state?.status;

  // Once a game is running, leaving it (finished or stopped) starts from the start screen.
  useEffect(() => {
    if (status === 'in_progress') setView('start');
  }, [status]);

  // The game on the table keeps its own theme; otherwise the theme picked for the next game.
  const showsGame =
    state?.status === 'in_progress' || (state?.status === 'finished' && view === 'start');
  const theme = (showsGame && gameTheme) || preferredTheme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  let screen;
  if (state === undefined) {
    screen = (
      <main className="screen">
        <p className="hint">{nl.start.connecting}</p>
      </main>
    );
  } else if (state?.status === 'in_progress') {
    screen = <GameScreen state={state} actions={actions} muted={muted} onMute={setMuted} />;
  } else if (state?.status === 'finished' && view === 'start') {
    screen = (
      <EndScreen
        state={state}
        onRematch={() => void actions.rematch()}
        onNewGame={() => setView('setup')}
      />
    );
  } else if (view === 'setup') {
    screen = (
      <SetupScreen
        onStart={actions.create}
        onBack={() => setView('start')}
        theme={preferredTheme}
        recentPlayers={recentPlayers}
      />
    );
  } else {
    screen = (
      <StartScreen
        theme={preferredTheme}
        onTheme={setPreferredTheme}
        muted={muted}
        onMute={setMuted}
        onNewGame={() => setView('setup')}
      />
    );
  }

  return (
    <>
      {state !== undefined && !connected && (
        <p className="connection-banner" role="status">
          {nl.errors.disconnected}
        </p>
      )}
      {saveFailed && (
        <p className="save-banner" role="status">
          {nl.history.saveFailed}
        </p>
      )}
      {screen}
      <FunLayer state={state} theme={theme} />
      {unfinished && (
        <UnfinishedDialog
          game={unfinished}
          onContinue={() => void actions.resume()}
          onStop={() => void actions.discardUnfinished()}
        />
      )}
    </>
  );
}
