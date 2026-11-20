import { Suspense, lazy, useCallback, useRef, useState } from 'react';
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
import type { ClientResult, GameActions } from '../useGame';
import { Dice } from './Dice';
import { Dialog } from './Dialog';
import { MuteButton } from './MuteButton';
import { ScoreTable } from './ScoreTable';

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

type Open = { kind: 'confirm'; box: BoxId; points: number } | { kind: 'rules' } | { kind: 'stop' };

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

  return (
    <main className="screen game-screen">
      <header className="game-bar">
        <span className="round">{nl.game.round(state.round, ROUNDS)}</span>
        <ul className="scores" aria-label={nl.game.scores}>
          {state.players.map((p, i) => (
            <li
              key={p.id}
              className={i === state.currentPlayerIndex ? 'score-chip current' : 'score-chip'}
              style={{ borderColor: p.colour }}
              aria-current={i === state.currentPlayerIndex ? 'true' : undefined}
            >
              <span className="avatar">{avatarEmoji(p.avatar)}</span>
              <span className="name">{p.name}</span>
              <span className="points">{totals(state.scorecards[i]!).grandTotal}</span>
            </li>
          ))}
        </ul>
        <span className="menu">
          <MuteButton muted={muted} onChange={onMute} />
          <button type="button" className="button" onClick={() => setOpen({ kind: 'rules' })}>
            {nl.game.rules}
          </button>
          <button type="button" className="button" onClick={() => setOpen({ kind: 'stop' })}>
            {nl.game.stop}
          </button>
        </span>
      </header>

      <div className="table">
        <section className="dice-area themed-table" ref={areaRef}>
          <h2 className="turn-banner" style={{ backgroundColor: player.colour }}>
            {avatarEmoji(player.avatar)} {nl.game.turn(player.name)}
          </h2>
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
          <button
            type="button"
            className="button big roll-button"
            disabled={rollsLeft === 0}
            onClick={() => run(actions.roll)}
          >
            {rollsLeft > 0
              ? `${nl.game.roll} (${nl.game.rollsLeft(rollsLeft)})`
              : nl.game.chooseBox}
          </button>
          <p className="hint">{state.dice ? nl.game.holdHint : nl.game.rollFirst}</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="card-area">
          <ScoreTable
            split
            players={[player]}
            scorecards={[card]}
            choose={{
              dice: state.dice,
              onChoose: (box, points) => setOpen({ kind: 'confirm', box, points }),
            }}
          />
        </section>
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
