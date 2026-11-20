import { useEffect, useRef } from 'react';
import { DEFAULT_THEME } from '@yahtzee/server/looks';
import type { Hello } from '@yahtzee/server/protocol';
import { EndScreen } from '../components/EndScreen';
import { FunLayer } from '../components/FunLayer';
import { GameScreen } from '../components/GameScreen';
import { MuteButton } from '../components/MuteButton';
import { nl } from '../i18n/nl';
import { readSeatToken, useMuted, writeSeatToken } from '../settings';
import { useDeviceSound } from '../sound/useDeviceSound';
import { useConnection } from '../useGame';
import { JoinForm } from './JoinForm';
import { WaitingRoom } from './WaitingRoom';
import { WhoAreYou } from './WhoAreYou';

/** A phone sends its seat token on every (re)connect, so it gets its player back. */
const phoneHello = (): Hello => ({ role: 'phone', token: readSeatToken() });

/** A short buzz when it becomes this phone's turn (Android; iPhones cannot vibrate from a web page). */
function useYourTurnBuzz(myTurn: boolean): void {
  const before = useRef(myTurn);
  useEffect(() => {
    if (myTurn && !before.current) navigator.vibrate?.(200);
    before.current = myTurn;
  }, [myTurn]);
}

/** The player view on a phone (route `/speler`). It only ever controls its own player. */
export function PlayerApp() {
  const {
    state,
    theme: gameTheme,
    connected,
    lobby,
    seats,
    you,
    actions,
    lobbyActions,
  } = useConnection(phoneHello, writeSeatToken);
  const [muted, setMuted] = useMuted();
  useDeviceSound(muted);

  const meInLobby = lobby?.players.find((p) => p.id === you);
  const inGame = !!state && state.players.some((p) => p.id === you);
  const myTurn =
    state?.status === 'in_progress' && state.players[state.currentPlayerIndex]?.id === you;
  useYourTurnBuzz(myTurn);
  const theme = lobby?.theme ?? gameTheme ?? DEFAULT_THEME;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  let screen;
  if (state === undefined) {
    screen = <p className="hint">{nl.start.connecting}</p>;
  } else if (state?.status === 'in_progress' && inGame) {
    return (
      <>
        {!connected && (
          <p className="connection-banner" role="status">
            {nl.errors.disconnected}
          </p>
        )}
        <GameScreen
          state={state}
          actions={actions}
          theme={theme}
          muted={muted}
          onMute={setMuted}
          seats={seats}
          me={you!}
        />
        <FunLayer state={state} theme={theme} />
      </>
    );
  } else if (lobby && meInLobby) {
    screen = (
      <WaitingRoom
        lobby={lobby}
        me={meInLobby}
        onChange={(change) => lobbyActions.update(meInLobby.id, change)}
        onLeave={() => lobbyActions.remove(meInLobby.id)}
      />
    );
  } else if (lobby) {
    screen = <JoinForm lobby={lobby} onJoin={lobbyActions.join} />;
  } else if (state?.status === 'finished' && inGame) {
    return (
      <>
        <EndScreen state={state} theme={theme} />
        <FunLayer state={state} theme={theme} />
      </>
    );
  } else if (state?.status === 'in_progress') {
    screen = <WhoAreYou state={state} seats={seats} onClaim={lobbyActions.claim} />;
  } else {
    screen = (
      <section className="card phone-card">
        <h1>{nl.phone.waitingForGame}</h1>
        <p className="hint">{nl.phone.waitingHint}</p>
      </section>
    );
  }

  return (
    <>
      {state !== undefined && !connected && (
        <p className="connection-banner" role="status">
          {nl.errors.disconnected}
        </p>
      )}
      <main className="screen phone-screen">
        <header className="phone-header">
          <span className="phone-brand">{nl.appName}</span>
          <MuteButton muted={muted} onChange={setMuted} />
        </header>
        {screen}
      </main>
    </>
  );
}
