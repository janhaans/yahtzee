import confetti from 'canvas-confetti';
import type { ThemeId } from '@yahtzee/server/looks';

/**
 * Confetti, fireworks and raining sweets, drawn by canvas-confetti (bundled with the app, so
 * no internet is needed). Every function returns a stop function.
 */

const SPRINKLES = ['#74c0fc', '#ffd43b', '#63e6be', '#b197fc', '#ff8787', '#f783ac'];
const STADIUM = ['#ffffff', '#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c'];

let sweets: confetti.Shape[] | null = null;

function sweetShapes(): confetti.Shape[] {
  sweets ??= ['🍬', '🍭', '🍩', '🧁', '🍫'].map((text) =>
    confetti.shapeFromText({ text, scalar: 2 }),
  );
  return sweets;
}

function repeat(times: number, everyMs: number, burst: (i: number) => void): () => void {
  let i = 0;
  burst(i++);
  const timer = setInterval(() => {
    if (i >= times) return clearInterval(timer);
    burst(i++);
  }, everyMs);
  return () => clearInterval(timer);
}

/** Fireworks over the stadium. */
function fireworks(times: number): () => void {
  return repeat(times, 350, () => {
    confetti({
      particleCount: 60,
      spread: 360,
      startVelocity: 28,
      gravity: 0.7,
      ticks: 90,
      colors: STADIUM,
      origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.35 },
    });
  });
}

/** Sweets and sprinkles raining down. */
function sweetRain(times: number): () => void {
  return repeat(times, 250, () => {
    const x = Math.random();
    confetti({
      particleCount: 6,
      shapes: sweetShapes(),
      scalar: 2,
      flat: true,
      angle: 270,
      spread: 40,
      startVelocity: 8,
      gravity: 0.9,
      ticks: 220,
      origin: { x, y: -0.1 },
    });
    confetti({
      particleCount: 25,
      angle: 270,
      spread: 120,
      startVelocity: 10,
      gravity: 0.8,
      ticks: 200,
      colors: SPRINKLES,
      shapes: ['square'],
      scalar: 0.7,
      origin: { x: Math.random(), y: -0.1 },
    });
  });
}

export function celebrateYahtzee(theme: ThemeId): () => void {
  return theme === 'voetbal' ? fireworks(6) : sweetRain(10);
}

/** The winner party: a big confetti shower plus the theme's own fun. */
export function celebrateWinner(theme: ThemeId): () => void {
  const colours = theme === 'voetbal' ? STADIUM : SPRINKLES;
  const stopShower = repeat(8, 300, (i) => {
    confetti({
      particleCount: 50,
      angle: i % 2 === 0 ? 60 : 120,
      spread: 70,
      origin: { x: i % 2 === 0 ? 0 : 1, y: 0.7 },
      colors: colours,
    });
  });
  const stopTheme = theme === 'voetbal' ? fireworks(5) : sweetRain(8);
  return () => {
    stopShower();
    stopTheme();
  };
}

/** Stops everything and clears the confetti. */
export function stopConfetti(): void {
  confetti.reset();
}
