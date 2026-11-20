import { Body, Box, Plane, Vec3, World } from 'cannon-es';
import type { Quat } from './faces';

/**
 * Throws the dice in a physics world and records every frame, before anything is shown.
 * Distances are in die sizes (a die is 1 x 1 x 1); the table lies at y = 0.
 */

export const FRAME_SECONDS = 1 / 60;
/** The throw is cut off after this many frames; the dice then glide into their row. */
export const MAX_FRAMES = 38;

export interface Point {
  readonly x: number;
  readonly z: number;
}

export interface ThrowInput {
  /** Where each die rests in its row; held dice stay there. */
  readonly slots: readonly Point[];
  /** Half the table size: the walls are here. */
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly held: readonly boolean[];
  /** How held dice lie right now, so the others bounce off them as they are. */
  readonly heldTurns: readonly Quat[];
  readonly random: () => number;
}

export interface Frame {
  readonly positions: readonly (readonly [number, number, number])[];
  readonly turns: readonly Quat[];
}

export interface Hit {
  readonly frame: number;
  /** 0 to 1, for the clack volume. */
  readonly strength: number;
}

export interface ThrowResult {
  readonly frames: readonly Frame[];
  readonly hits: readonly Hit[];
}

const GRAVITY = -70;
const HALF = 0.5;
/** Impact speed that counts as the loudest clack. */
const LOUDEST = 9;

function wall(world: World, normal: Vec3, offset: number): void {
  const body = new Body({ mass: 0, shape: new Plane() });
  body.quaternion.setFromVectors(new Vec3(0, 0, 1), normal);
  body.position.copy(normal.scale(-offset));
  world.addBody(body);
}

export function throwDice(input: ThrowInput): ThrowResult {
  const { random } = input;
  const world = new World({ gravity: new Vec3(0, GRAVITY, 0), allowSleep: true });
  world.defaultContactMaterial.friction = 0.35;
  world.defaultContactMaterial.restitution = 0.35;

  // Floor and four walls just inside the table edge.
  wall(world, new Vec3(0, 1, 0), 0);
  wall(world, new Vec3(1, 0, 0), input.halfWidth);
  wall(world, new Vec3(-1, 0, 0), input.halfWidth);
  wall(world, new Vec3(0, 0, 1), input.halfDepth);
  wall(world, new Vec3(0, 0, -1), input.halfDepth);

  const hits: Hit[] = [];
  let frame = 0;
  const range = (min: number, max: number) => min + random() * (max - min);

  const bodies = input.slots.map((slot, i) => {
    const held = input.held[i]!;
    const body = new Body({
      mass: held ? 0 : 1,
      shape: new Box(new Vec3(HALF, HALF, HALF)),
      linearDamping: 0.25,
      angularDamping: 0.3,
      sleepSpeedLimit: 0.3,
    });
    if (held) {
      const q = input.heldTurns[i]!;
      body.position.set(slot.x, HALF, slot.z);
      body.quaternion.set(q.x, q.y, q.z, q.w);
    } else {
      // Thrown in from the near edge of the table, spinning, one above the other.
      body.position.set(range(-0.5, 0.5) * input.halfWidth, 1.2 + i * 1.1, input.halfDepth - 0.8);
      body.quaternion.setFromEuler(range(0, 6.3), range(0, 6.3), range(0, 6.3));
      body.velocity.set(range(-4, 4), range(0, 3), -range(6, 9));
      body.angularVelocity.set(range(-25, 25), range(-25, 25), range(-25, 25));
      body.addEventListener(
        'collide',
        (event: { contact: { getImpactVelocityAlongNormal(): number } }) => {
          const speed = Math.abs(event.contact.getImpactVelocityAlongNormal());
          if (speed > 0.8) hits.push({ frame, strength: Math.min(1, speed / LOUDEST) });
        },
      );
    }
    world.addBody(body);
    return body;
  });

  const thrown = bodies.filter((_, i) => !input.held[i]);
  const frames: Frame[] = [];
  for (frame = 0; frame < MAX_FRAMES; frame++) {
    world.step(FRAME_SECONDS);
    frames.push({
      positions: bodies.map((b) => [b.position.x, b.position.y, b.position.z] as const),
      turns: bodies.map(({ quaternion: q }) => ({ x: q.x, y: q.y, z: q.z, w: q.w })),
    });
    if (frame > 15 && thrown.every((b) => b.velocity.length() < 0.3)) break;
  }
  return { frames, hits };
}
