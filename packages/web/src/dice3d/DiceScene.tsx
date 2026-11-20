import { useEffect, useRef, type RefObject } from 'react';
import type { Dice, Held } from '@yahtzee/game-logic';
import type { ThemeId } from '@yahtzee/server/looks';
import { sound } from '../sound/engine';
import { THEMES } from '../themes';
import { DiceTable, type Layout } from './table';

interface Props {
  dice: Dice | null;
  held: Held;
  rollId: string;
  theme: ThemeId;
  /** The dice table area: the canvas covers it. */
  area: RefObject<HTMLElement | null>;
  /** The row of die buttons: the dice land right under them. */
  slots: RefObject<HTMLElement | null>;
  /** Called once the 3D dice are on screen, so the flat dice can step aside. */
  onReady: () => void;
}

/** Share of a die button the 3D die fills. */
const DIE_FILL = 0.92;

function measure(area: HTMLElement, slots: HTMLElement): Layout | null {
  const box = area.getBoundingClientRect();
  const buttons = [...slots.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
  if (box.width === 0 || buttons.length === 0) return null;
  return {
    width: box.width,
    height: box.height,
    dieSize: buttons[0]!.width * DIE_FILL,
    slots: buttons.map((b) => ({
      x: b.left + b.width / 2 - box.left,
      y: b.top + b.height / 2 - box.top,
    })),
  };
}

/** The laptop's 3D dice, drawn on a canvas over the dice table. Loaded only when needed. */
export default function DiceScene({ dice, held, rollId, theme, area, slots, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tableRef = useRef<DiceTable | null>(null);
  const latest = useRef({ dice, held, theme });
  latest.current = { dice, held, theme };
  const lastRoll = useRef(rollId);

  // Create the table once; keep it the size of the dice area.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const table = new DiceTable(canvas, THEMES[latest.current.theme].dice, {
      onClack: (strength) => sound.clack(latest.current.theme, strength),
    });
    tableRef.current = table;

    const relayout = () => {
      const layout = area.current && slots.current && measure(area.current, slots.current);
      if (layout) table.setLayout(layout);
    };
    relayout();
    table.show(latest.current.dice, latest.current.held);
    const observer = new ResizeObserver(relayout);
    if (area.current) observer.observe(area.current);

    // A tap during a throw only skips it; it does not hold a die or roll again.
    const skip = (event: Event) => {
      if (!table.rolling) return;
      event.stopPropagation();
      event.preventDefault();
      table.skip();
    };
    const target = area.current;
    target?.addEventListener('click', skip, true);
    onReady();

    return () => {
      target?.removeEventListener('click', skip, true);
      observer.disconnect();
      table.dispose();
      tableRef.current = null;
    };
  }, [area, slots, onReady]);

  useEffect(() => {
    tableRef.current?.setLook(THEMES[theme].dice);
  }, [theme]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    if (rollId !== lastRoll.current) {
      lastRoll.current = rollId;
      const now = latest.current;
      if (now.dice === null) {
        table.show(null, now.held);
      } else {
        // The dice buttons may have moved (a message, a banner): measure before throwing.
        const layout = area.current && slots.current && measure(area.current, slots.current);
        if (layout) table.setLayout(layout);
        table.roll(now.dice, now.held);
      }
    }
  }, [rollId, area, slots]);

  useEffect(() => {
    tableRef.current?.setHeld(held);
  }, [held]);

  return <canvas ref={canvasRef} className="dice-canvas" aria-hidden="true" />;
}
