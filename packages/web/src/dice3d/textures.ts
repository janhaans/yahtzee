import { CanvasTexture, SRGBColorSpace } from 'three';
import type { DieValue } from '@yahtzee/game-logic';
import type { DiceLook } from '../themes';

const SIZE = 256;

/** Pip centres on a 3 x 3 grid, as in the CSS dice. */
const PIPS: Record<DieValue, readonly number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

function drawPattern(ctx: CanvasRenderingContext2D, look: DiceLook): void {
  ctx.fillStyle = look.patternColour;
  if (look.pattern === 'football') {
    // Patches in the corners, like the panels of a football.
    for (const [x, y] of [
      [0, 0],
      [SIZE, 0],
      [0, SIZE],
      [SIZE, SIZE],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, SIZE * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Sugar crystals, the same on every face so the dice look alike.
    for (let i = 0; i < 70; i++) {
      const x = (i * 97) % SIZE;
      const y = (i * 61 + (i % 7) * 13) % SIZE;
      ctx.fillRect(x, y, 5 + (i % 3) * 2, 5 + (i % 2) * 2);
    }
  }
}

/** One face of a die: its colour, decoration and pips. */
export function faceTexture(look: DiceLook, value: DieValue): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = look.face;
  ctx.fillRect(0, 0, SIZE, SIZE);
  drawPattern(ctx, look);

  ctx.fillStyle = look.pip;
  for (const spot of PIPS[value]) {
    const col = (spot - 1) % 3;
    const row = Math.floor((spot - 1) / 3);
    ctx.beginPath();
    ctx.arc(SIZE * (0.25 + col * 0.25), SIZE * (0.25 + row * 0.25), SIZE * 0.085, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
