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
import { canUse3D } from './dice3d/support';
import { useDeviceSound } from './sound/useDeviceSound';
import { useGame } from './useGame';

/** The game table on the laptop (route `/`). */
export function App() {
  const {
    state,
    theme: gameTheme,
    connected,
    lobby,
    unfinished,
    saveFailed,
    actions,
    lobbyActions,
  } = useGame();
  const [preferredTheme, setPreferredTheme] = useThemePreference();
  const [muted, setMuted] = useMuted();
  const [dice3D] = useState(canUse3D);

  useDeviceSound(muted);
  // The server decides the screen: the lobby while a new game is set up, then the game.
  const recentPlayers = useRecentPlayers(lobby !== null);
  const newGame = () => void lobbyActions.open(preferredTheme);

  // The game on the table keeps its own theme; the lobby has the theme of the next game.
  const showsGame =
    lobby === null && (state?.status === 'in_progress' || state?.status === 'finished');
  const theme = lobby?.theme ?? ((showsGame && gameTheme) || preferredTheme);
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
  } else if (lobby !== null) {
    screen = (
      <SetupScreen
        lobby={lobby}
        actions={lobbyActions}
        onBack={() => void lobbyActions.close()}
        recentPlayers={recentPlayers}
      />
    );
  } else if (state?.status === 'in_progress') {
    screen = (
      <GameScreen
        state={state}
        actions={actions}
        theme={theme}
        muted={muted}
        onMute={setMuted}
        dice3D={dice3D}
      />
    );
  } else if (state?.status === 'finished') {
    screen = (
      <EndScreen
        state={state}
        theme={theme}
        onRematch={() => void actions.rematch()}
        onNewGame={newGame}
      />
    );
  } else {
    screen = (
      <StartScreen
        theme={preferredTheme}
        onTheme={setPreferredTheme}
        muted={muted}
        onMute={setMuted}
        onNewGame={newGame}
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
