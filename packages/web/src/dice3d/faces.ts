import type { DieValue } from '@yahtzee/game-logic';

/**
 * The trick behind the 3D dice: physics decides how a die tumbles and which of its six faces
 * ends on top; then the faces are labelled so that face shows the value the server rolled.
 * The labels always form a real die (opposite faces add up to 7).
 */

type Vec = readonly [number, number, number];

/** Face directions in the die's own space, in the material order of a three.js box. */
export const FACE_NORMALS: readonly Vec[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** A standard die, labelled per face (same order as FACE_NORMALS). */
const BASE_LABELS: readonly DieValue[] = [2, 5, 1, 6, 3, 4];

export interface Quat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

/** The world "up" component of a direction in die space after rotating it by `q`. */
function upAfter(q: Quat, [vx, vy, vz]: Vec): number {
  // y of q * v * q⁻¹, written out.
  const { x, y, z, w } = q;
  return 2 * (x * y + w * z) * vx + (1 - 2 * (x * x + z * z)) * vy + 2 * (y * z - w * x) * vz;
}

/** The face (index into FACE_NORMALS) that points most upwards. */
export function upFace(q: Quat): number {
  let best = 0;
  let bestUp = -Infinity;
  FACE_NORMALS.forEach((normal, face) => {
    const up = upAfter(q, normal);
    if (up > bestUp) {
      best = face;
      bestUp = up;
    }
  });
  return best;
}

type Matrix = readonly [Vec, Vec, Vec];

function apply(m: Matrix, v: Vec): Vec {
  return [0, 1, 2].map(
    (r) => m[r]![0] * v[0] + m[r]![1] * v[1] + m[r]![2] * v[2],
  ) as unknown as Vec;
}

function multiply(a: Matrix, b: Matrix): Matrix {
  return [0, 1, 2].map((r) =>
    [0, 1, 2].map((c) => a[r]![0] * b[0]![c]! + a[r]![1] * b[1]![c]! + a[r]![2] * b[2]![c]!),
  ) as unknown as Matrix;
}

function faceIndex(v: Vec): number {
  return FACE_NORMALS.findIndex((n) => n[0] === v[0] && n[1] === v[1] && n[2] === v[2]);
}

/** All 24 ways a die can be turned, found from quarter turns around X and Y. */
function allTurns(): Matrix[] {
  const quarterX: Matrix = [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ];
  const quarterY: Matrix = [
    [0, 0, 1],
    [0, 1, 0],
    [-1, 0, 0],
  ];
  const identity: Matrix = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const found = new Map<string, Matrix>([[JSON.stringify(identity), identity]]);
  const queue = [identity];
  while (queue.length > 0) {
    const m = queue.shift()!;
    for (const turn of [quarterX, quarterY]) {
      const next = multiply(turn, m);
      const key = JSON.stringify(next);
      if (!found.has(key)) {
        found.set(key, next);
        queue.push(next);
      }
    }
  }
  return [...found.values()];
}

/** The labels of a standard die in each of its 24 orientations. */
export const LABELINGS: readonly (readonly DieValue[])[] = allTurns().map((turn) => {
  const labels: DieValue[] = [];
  FACE_NORMALS.forEach((normal, face) => {
    labels[faceIndex(apply(turn, normal))] = BASE_LABELS[face]!;
  });
  return labels;
});

/**
 * Labels for a die so that `face` shows `value`. There are four such dice (turned around
 * the up axis); `pick` chooses one, so the side faces differ from roll to roll.
 */
export function labelsFor(face: number, value: DieValue, pick = 0): readonly DieValue[] {
  const options = LABELINGS.filter((labels) => labels[face] === value);
  return options[Math.abs(Math.floor(pick)) % options.length]!;
}
