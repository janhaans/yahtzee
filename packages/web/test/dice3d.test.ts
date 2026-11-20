import { describe, expect, it } from 'vitest';
import type { DieValue } from '@yahtzee/game-logic';
import { FACE_NORMALS, LABELINGS, labelsFor, upFace, type Quat } from '../src/dice3d/faces';
import { MAX_FRAMES, throwDice } from '../src/dice3d/simulate';
import { seededRng } from '../../server/src/rng';

const VALUES: DieValue[] = [1, 2, 3, 4, 5, 6];
/** Opposite faces in FACE_NORMALS order: +X/-X, +Y/-Y, +Z/-Z. */
const OPPOSITE = [1, 0, 3, 2, 5, 4];

function turn(axis: 'x' | 'y' | 'z', degrees: number): Quat {
  const half = (degrees * Math.PI) / 360;
  return {
    x: axis === 'x' ? Math.sin(half) : 0,
    y: axis === 'y' ? Math.sin(half) : 0,
    z: axis === 'z' ? Math.sin(half) : 0,
    w: Math.cos(half),
  };
}

describe('dice faces', () => {
  it('knows which face is on top', () => {
    expect(upFace({ x: 0, y: 0, z: 0, w: 1 })).toBe(2); // +Y
    expect(upFace(turn('x', 180))).toBe(3); // -Y
    expect(upFace(turn('z', 90))).toBe(0); // +X turned up
    expect(upFace(turn('z', -90))).toBe(1);
    expect(upFace(turn('x', -90))).toBe(4); // +Z turned up
    expect(upFace(turn('x', 90))).toBe(5);
    // A die that is still a bit tilted counts the face closest to the top.
    expect(upFace(turn('x', 30))).toBe(2);
  });

  it('has the 24 ways to turn a real die', () => {
    expect(LABELINGS).toHaveLength(24);
    expect(new Set(LABELINGS.map((l) => l.join())).size).toBe(24);
    for (const labels of LABELINGS) {
      expect([...labels].sort()).toEqual(VALUES);
      labels.forEach((value, face) => expect(value + labels[OPPOSITE[face]!]!).toBe(7));
    }
  });

  it('labels any face with any value, in four ways', () => {
    for (const face of FACE_NORMALS.keys()) {
      for (const value of VALUES) {
        const options = new Set([0, 1, 2, 3].map((pick) => labelsFor(face, value, pick).join()));
        expect(options.size).toBe(4);
        for (const pick of [0, 1, 2, 3, 7, -1, 2.6]) {
          expect(labelsFor(face, value, pick)[face]).toBe(value);
        }
      }
    }
    expect(labelsFor(2, 1)).toEqual(labelsFor(2, 1, 0));
  });
});

describe('throwDice', () => {
  const slots = [-2.2, -1.1, 0, 1.1, 2.2].map((x) => ({ x, z: 0 }));
  const flat = { x: 0, y: 0, z: 0, w: 1 };

  function run(held: boolean[], seed = 7) {
    return throwDice({
      slots,
      halfWidth: 5,
      halfDepth: 3,
      held,
      heldTurns: slots.map(() => flat),
      random: seededRng(seed),
    });
  }

  it('throws the dice that are not held and keeps held dice still', () => {
    const { frames, hits } = run([true, false, false, false, true]);
    expect(frames.length).toBeGreaterThan(10);
    expect(frames.length).toBeLessThanOrEqual(MAX_FRAMES);
    for (const frame of frames) {
      expect(frame.positions[0]).toEqual([-2.2, 0.5, 0]);
      expect(frame.positions[4]).toEqual([2.2, 0.5, 0]);
    }
    expect(frames[0]!.positions[2]![1]).toBeGreaterThan(1);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.strength > 0 && h.strength <= 1)).toBe(true);
  });

  it('keeps every die on the table, above the floor', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { frames } = run([false, false, false, false, false], seed);
      for (const [x, y, z] of frames.at(-1)!.positions) {
        expect(Math.abs(x)).toBeLessThan(5);
        expect(Math.abs(z)).toBeLessThan(3);
        expect(y).toBeGreaterThan(0.3);
      }
    }
  });

  it('gives the same throw for the same random numbers', () => {
    expect(run([false, true, false, true, false], 9)).toEqual(
      run([false, true, false, true, false], 9),
    );
  });
});
