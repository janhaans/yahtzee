import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_ROLLS,
  ROUNDS,
  earnsYahtzeeBonus,
  totals,
  type BoxId,
  type GameState,
} from '@yahtzee/game-logic';
import { DEFAULT_THEME, type ThemeId } from '@yahtzee/server/looks';
import { avatarEmoji } from '../avatars';
import { nl } from '../i18n/nl';
import { reducedMotion } from '../motion';
import type { ClientResult, GameActions } from '../useGame';
import { Dice } from './Dice';
import { Dialog } from './Dialog';
import { JoinPanel } from './JoinPanel';
import { MenuIcon } from './Icons';
import { MuteButton } from './MuteButton';
import { ScoreCard } from './ScoreCard';

interface Props {
  state: GameState;
  actions: GameActions;
  theme?: ThemeId;
  muted?: boolean;
  onMute?: (muted: boolean) => void;
  /** Throw real 3D dice (laptop with WebGL); otherwise CSS cubes. */
  dice3D?: boolean;
}

// three.js and the physics engine are only downloaded when the 3D dice are used.
const DiceScene = lazy(() => import('../dice3d/DiceScene'));

type Open =
  | { kind: 'confirm'; box: BoxId; points: number }
  | { kind: 'rules' }
  | { kind: 'stop' }
  | { kind: 'join' };

export function GameScreen({
  state,
  actions,
  theme = DEFAULT_THEME,
  muted = false,
  onMute = () => {},
  dice3D = false,
}: Props) {
  const [open, setOpen] = useState<Open | null>(null);
  const areaRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [scene3D, setScene3D] = useState(false);
  const onSceneReady = useCallback(() => setScene3D(true), []);
  const [error, setError] = useState<string | null>(null);

  const player = state.players[state.currentPlayerIndex]!;
  const card = state.scorecards[state.currentPlayerIndex]!;
  const rollsLeft = MAX_ROLLS - state.rollsUsed;
  const rollId = `${state.round}-${state.currentPlayerIndex}-${state.rollsUsed}`;
  const turnId = `${state.round}-${state.currentPlayerIndex}`;
  const leaving = useLeavingName(turnId, player.name);
  const close = () => setOpen(null);

  const run = async (action: () => Promise<ClientResult>) => {
    const result = await action();
    setError(result.ok ? null : nl.errors[result.error]);
    return result;
  };

  const confirmChoice = async (box: BoxId) => {
    close();
    await run(() => actions.chooseBox(box));
  };

  const status = !state.dice
    ? nl.game.rollFirst
    : rollsLeft > 0
      ? `${nl.game.rollOf(state.rollsUsed, MAX_ROLLS)} · ${nl.game.holdHint}`
      : nl.game.chooseBoxHint;

  return (
    <main className="screen game-screen">
      <header className="game-bar">
        <span className="brand-name">{nl.appName}</span>
        <span className="round">{nl.game.round(state.round, ROUNDS)}</span>
        <ul className="scores" aria-label={nl.game.scores}>
          {state.players.map((p, i) => (
            <li
              key={p.id}
              className={i === state.currentPlayerIndex ? 'score-chip current' : 'score-chip'}
              aria-current={i === state.currentPlayerIndex ? 'true' : undefined}
            >
              {/* A new element every turn, so its soft pulse plays once per turn change. */}
              {i === state.currentPlayerIndex && (
                <span key={turnId} className="turn-pulse" aria-hidden="true" />
              )}
              <span className="avatar-circle" style={{ backgroundColor: p.colour }}>
                {avatarEmoji(p.avatar)}
              </span>
              <span className="name">{p.name}</span>
              <span className="points">{totals(state.scorecards[i]!).grandTotal}</span>
            </li>
          ))}
        </ul>
        <span className="menu">
          <MuteButton muted={muted} onChange={onMute} />
          <GameMenu
            onRules={() => setOpen({ kind: 'rules' })}
            onJoin={() => setOpen({ kind: 'join' })}
            onStop={() => setOpen({ kind: 'stop' })}
          />
        </span>
      </header>

      <div className="table">
        <section className="dice-area themed-table" ref={areaRef}>
          <div className="turn-heading">
            {/* The old name fades out while the new one fades in. */}
            <div className="turn-names">
              {leaving && (
                <p className="turn-banner leaving" aria-hidden="true">
                  {nl.game.turn(leaving)}
                </p>
              )}
              <h2 key={turnId} className="turn-banner">
                {nl.game.turn(player.name)}
              </h2>
            </div>
            <p className="turn-status">{status}</p>
          </div>
          <Dice
            dice={state.dice}
            held={state.held}
            canHold={state.dice !== null && rollsLeft > 0}
            onToggle={(index) => run(() => actions.toggleHold(index))}
            theme={theme}
            rollId={rollId}
            variant={scene3D ? 'buttons' : 'cubes'}
            rowRef={rowRef}
          />
          {dice3D && (
            <Suspense fallback={null}>
              <DiceScene
                dice={state.dice}
                held={state.held}
                rollId={rollId}
                theme={theme}
                area={areaRef}
                slots={rowRef}
                onReady={onSceneReady}
              />
            </Suspense>
          )}
          {/* Funny messages appear here (see FunLayer). */}
          <div id="message-slot" className="message-slot" />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="button big roll-button"
            disabled={rollsLeft === 0}
            onClick={() => run(actions.roll)}
          >
            {rollsLeft > 0 ? (
              <>
                {nl.game.roll} <span className="badge">{nl.game.rollsLeft(rollsLeft)}</span>
              </>
            ) : (
              nl.game.chooseBox
            )}
          </button>
        </section>

        <ScoreCard
          player={player}
          card={card}
          dice={state.dice}
          onChoose={(box, points) => setOpen({ kind: 'confirm', box, points })}
        />
      </div>

      {open?.kind === 'confirm' && (
        <Dialog
          title={
            open.points === 0
              ? nl.confirm.scratch(nl.boxes[open.box])
              : nl.confirm.score(open.points, nl.boxes[open.box])
          }
          onClose={close}
          actions={
            <>
              <button type="button" className="button" onClick={close}>
                {nl.confirm.no}
              </button>
              <button type="button" className="button big" onClick={() => confirmChoice(open.box)}>
                {nl.confirm.yes}
              </button>
            </>
          }
        >
          {state.dice && earnsYahtzeeBonus(state.dice, card) && (
            <p className="bonus-note">{nl.confirm.yahtzeeBonus}</p>
          )}
        </Dialog>
      )}

      {open?.kind === 'rules' && (
        <Dialog
          title={nl.rules.title}
          onClose={close}
          actions={
            <button type="button" className="button" onClick={close}>
              {nl.confirm.close}
            </button>
          }
        >
          <ul className="rules">
            {nl.rules.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Dialog>
      )}

      {open?.kind === 'join' && (
        <Dialog
          title={nl.join.menu}
          onClose={close}
          actions={
            <button type="button" className="button" onClick={close}>
              {nl.confirm.close}
            </button>
          }
        >
          <JoinPanel />
        </Dialog>
      )}

      {open?.kind === 'stop' && (
        <Dialog
          title={nl.confirm.stop}
          onClose={close}
          actions={
            <>
              <button type="button" className="button" onClick={close}>
                {nl.confirm.stopNo}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  close();
                  void run(actions.abort);
                }}
              >
                {nl.confirm.stopYes}
              </button>
            </>
          }
        />
      )}
    </main>
  );
}

/** How long the old player's name stays to fade out on a turn change. */
const TURN_FADE_MS = 300;

/**
 * The previous player's name for a moment after the turn changes, so the heading can
 * cross-fade. Null otherwise, and always null when the device asks for less motion.
 */
function useLeavingName(turnId: string, name: string): string | null {
  const [leaving, setLeaving] = useState<string | null>(null);
  const last = useRef({ turnId, name });

  useEffect(() => {
    const before = last.current;
    if (before.turnId === turnId) return;
    last.current = { turnId, name };
    if (reducedMotion() || before.name === name) return;
    setLeaving(before.name);
    const timer = setTimeout(() => setLeaving(null), TURN_FADE_MS);
    return () => clearTimeout(timer);
  }, [turnId, name]);

  return leaving;
}

interface GameMenuProps {
  onRules: () => void;
  onJoin: () => void;
  onStop: () => void;
}

/** The ☰ button with the less frequent actions: rules, a phone's QR code, stopping. */
function GameMenu({ onRules, onJoin, onStop }: GameMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !ref.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <span className="game-menu" ref={ref}>
      <button
        type="button"
        className="button round"
        aria-label={nl.game.menu}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <MenuIcon />
      </button>
      {open && (
        <span className="menu-list card">
          <button type="button" className="button soft" onClick={choose(onRules)}>
            {nl.game.rules}
          </button>
          <button type="button" className="button soft" onClick={choose(onJoin)}>
            {nl.join.menu}
          </button>
          <button type="button" className="button soft" onClick={choose(onStop)}>
            {nl.game.stop}
          </button>
        </span>
      )}
    </span>
  );
}
