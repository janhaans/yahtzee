import { useEffect } from 'react';
import { DEFAULT_THEME } from '@yahtzee/server/looks';
import type { Hello } from '@yahtzee/server/protocol';
import { MuteButton } from '../components/MuteButton';
import { nl } from '../i18n/nl';
import { readSeatToken, useMuted, writeSeatToken } from '../settings';
import { useDeviceSound } from '../sound/useDeviceSound';
import { useConnection } from '../useGame';
import { JoinForm } from './JoinForm';
import { WaitingRoom } from './WaitingRoom';

/** A phone sends its seat token on every (re)connect, so it gets its player back. */
const phoneHello = (): Hello => ({ role: 'phone', token: readSeatToken() });

/** The player view on a phone (route `/speler`). It only ever controls its own player. */
export function PlayerApp() {
  const {
    state,
    theme: gameTheme,
    connected,
    lobby,
    you,
    lobbyActions,
  } = useConnection(phoneHello, writeSeatToken);
  const [muted, setMuted] = useMuted();
  useDeviceSound(muted);

  const meInLobby = lobby?.players.find((p) => p.id === you);
  const theme = lobby?.theme ?? gameTheme ?? DEFAULT_THEME;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  let screen;
  if (state === undefined) {
    screen = <p className="hint">{nl.start.connecting}</p>;
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
  } else if (state?.status === 'in_progress') {
    screen = (
      <section className="card phone-card">
        <p>{nl.phone.gameRunning}</p>
      </section>
    );
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
