import { useEffect, useState } from 'react';
import { EndScreen } from './components/EndScreen';
import { GameScreen } from './components/GameScreen';
import { SetupScreen } from './components/SetupScreen';
import { StartScreen } from './components/StartScreen';
import { nl } from './i18n/nl';
import { useGame } from './useGame';

/** The game table on the laptop (route `/`). */
export function App() {
  const { state, connected, actions } = useGame();
  const [view, setView] = useState<'start' | 'setup'>('start');
  const status = state?.status;

  // Once a game is running, leaving it (finished or stopped) starts from the start screen.
  useEffect(() => {
    if (status === 'in_progress') setView('start');
  }, [status]);

  let screen;
  if (state === undefined) {
    screen = (
      <main className="screen">
        <p className="hint">{nl.start.connecting}</p>
      </main>
    );
  } else if (state?.status === 'in_progress') {
    screen = <GameScreen state={state} actions={actions} />;
  } else if (state?.status === 'finished' && view === 'start') {
    screen = (
      <EndScreen
        state={state}
        onRematch={() => void actions.rematch()}
        onNewGame={() => setView('setup')}
      />
    );
  } else if (view === 'setup') {
    screen = <SetupScreen onStart={actions.create} onBack={() => setView('start')} />;
  } else {
    screen = <StartScreen onNewGame={() => setView('setup')} />;
  }

  return (
    <>
      {state !== undefined && !connected && (
        <p className="connection-banner" role="status">
          {nl.errors.disconnected}
        </p>
      )}
      {screen}
    </>
  );
}
