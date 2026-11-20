import {
  AmbientLight,
  DirectionalLight,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
  type CanvasTexture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Dice, DieValue, Held } from '@yahtzee/game-logic';
import type { DiceLook } from '../themes';
import { FACE_NORMALS, labelsFor, upFace } from './faces';
import { FRAME_SECONDS, throwDice, type Point, type ThrowResult } from './simulate';
import { faceTexture } from './textures';

/** Where the dice rest, in CSS pixels relative to the canvas. */
export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly slots: readonly { readonly x: number; readonly y: number }[];
  /** Size of a die on screen. */
  readonly dieSize: number;
}

export interface TableEvents {
  /** A die hit something; `strength` is 0 to 1. */
  onClack(strength: number): void;
}

const FOV = 30;
const GLIDE_SECONDS = 0.2;
const UP = new Vector3(0, 1, 0);
const VALUES: readonly DieValue[] = [1, 2, 3, 4, 5, 6];

/** The 24 square turns of a die (all edges along the table), to land neatly in a row. */
const SQUARE_TURNS: readonly Quaternion[] = (() => {
  const turns: Quaternion[] = [];
  const axes = FACE_NORMALS.map(([x, y, z]) => new Vector3(x, y, z));
  for (const a of axes) {
    for (const b of axes) {
      if (Math.abs(a.dot(b)) > 0.5) continue;
      const c = new Vector3().crossVectors(a, b);
      turns.push(new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(a, b, c)));
    }
  }
  return turns;
})();

interface Roll {
  readonly result: ThrowResult;
  readonly startedAt: number;
  /** Where each thrown die ends: its slot, lying square with the right face up. */
  readonly targets: readonly { position: Vector3; turn: Quaternion }[];
  readonly thrown: readonly boolean[];
  hitsPlayed: number;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * The 3D dice table on the laptop: three.js draws it, cannon-es throws the dice. The camera
 * looks straight down, so one die size on the table is exactly `dieSize` pixels on screen
 * and the dice can land right under the (invisible) die buttons.
 */
export class DiceTable {
  readonly #renderer: WebGLRenderer;
  readonly #scene = new Scene();
  readonly #camera = new PerspectiveCamera(FOV, 1, 0.1, 500);
  readonly #light = new DirectionalLight(0xffffff, 1.5);
  readonly #shadow = new Mesh(new PlaneGeometry(1, 1), new ShadowMaterial({ opacity: 0.14 }));
  readonly #geometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.14);
  readonly #dice: Mesh<RoundedBoxGeometry, MeshStandardMaterial[]>[];
  /** Which value each face of each die shows. */
  readonly #labels: (readonly DieValue[])[] = [];
  /** How each die lies when it is not moving (held dice wiggle around this). */
  readonly #rest: Quaternion[] = [];
  #textures = new Map<DieValue, CanvasTexture>();
  #layout: Layout | null = null;
  #slots: Point[] = [];
  #held: boolean[] = [false, false, false, false, false];
  #roll: Roll | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    look: DiceLook,
    private readonly events: TableEvents,
    private readonly random: () => number = Math.random,
  ) {
    this.#renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = PCFSoftShadowMap;
    this.#camera.up.set(0, 0, -1);

    this.#scene.add(new AmbientLight(0xffffff, 2.1));
    // Almost straight above, so the white faces stay white and the shadow falls under the die.
    this.#light.position.set(-1, 14, 1.5);
    this.#light.shadow.radius = 6;
    this.#light.castShadow = true;
    this.#light.shadow.mapSize.set(1024, 1024);
    this.#scene.add(this.#light);
    this.#shadow.rotation.x = -Math.PI / 2;
    this.#shadow.receiveShadow = true;
    this.#scene.add(this.#shadow);

    this.#dice = VALUES.slice(0, 5).map(() => {
      const mesh = new Mesh(
        this.#geometry,
        FACE_NORMALS.map(() => new MeshStandardMaterial({ roughness: 0.6 })),
      );
      mesh.castShadow = true;
      mesh.visible = false;
      this.#scene.add(mesh);
      this.#labels.push(labelsFor(2, 1));
      this.#rest.push(new Quaternion());
      return mesh;
    });
    this.setLook(look);
    this.#renderer.setAnimationLoop((time) => this.#frame(time / 1000));
  }

  get rolling(): boolean {
    return this.#roll !== null;
  }

  setLook(look: DiceLook): void {
    for (const texture of this.#textures.values()) texture.dispose();
    this.#textures = new Map(VALUES.map((value) => [value, faceTexture(look, value)]));
    this.#dice.forEach((_, i) => this.#paint(i));
  }

  setLayout(layout: Layout): void {
    this.#layout = layout;
    const { width, height, dieSize } = layout;
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    // Straight above the table, at the height where one die is `dieSize` pixels.
    const halfView = height / dieSize / 2;
    this.#camera.position.set(0, 1 + halfView / Math.tan(((FOV / 2) * Math.PI) / 180), 0);
    this.#camera.lookAt(0, 0, 0);
    this.#camera.updateProjectionMatrix();
    this.#shadow.scale.set(width / dieSize, height / dieSize, 1);
    this.#slots = layout.slots.map((slot) => ({
      x: (slot.x - width / 2) / dieSize,
      z: (slot.y - height / 2) / dieSize,
    }));
    const shadow = this.#light.shadow.camera;
    shadow.left = shadow.bottom = -Math.max(width, height) / dieSize;
    shadow.right = shadow.top = Math.max(width, height) / dieSize;
    shadow.updateProjectionMatrix();
    if (!this.#roll) this.#dice.forEach((_, i) => this.#place(i, this.#rest[i]!));
  }

  /** Shows dice lying in their row, without a throw (after a reload, or a new layout). */
  show(dice: Dice | null, held: Held): void {
    this.#roll = null;
    this.#held = [...held];
    this.#dice.forEach((mesh, i) => {
      mesh.visible = dice !== null;
      if (!dice) return;
      this.#labels[i] = labelsFor(2, dice[i]!, this.random() * 4);
      this.#paint(i);
      this.#place(i, new Quaternion());
    });
  }

  /** Held dice stay in their place and wiggle; the glow is drawn around their button. */
  setHeld(held: Held): void {
    this.#held = [...held];
  }

  /** Throws the dice that are not held so they land on these values. */
  roll(dice: Dice, held: Held): void {
    const layout = this.#layout;
    if (!layout) return;
    this.#held = [...held];
    const result = throwDice({
      slots: this.#slots,
      halfWidth: layout.width / layout.dieSize / 2,
      halfDepth: layout.height / layout.dieSize / 2,
      held,
      heldTurns: this.#rest,
      random: this.random,
    });
    const last = result.frames.at(-1)!;

    const targets = this.#dice.map((mesh, i) => {
      if (held[i]) return { position: mesh.position.clone(), turn: this.#rest[i]!.clone() };
      // Label the die so whatever face ended on top shows the rolled value.
      const end = last.turns[i]!;
      const face = upFace(end);
      this.#labels[i] = labelsFor(face, dice[i]!, this.random() * 4);
      this.#paint(i);
      mesh.visible = true;
      const slot = this.#slots[i]!;
      return { position: new Vector3(slot.x, 0.5, slot.z), turn: this.#squareTurn(face, end) };
    });

    this.#roll = {
      result,
      startedAt: performance.now() / 1000,
      targets,
      thrown: held.map((h) => !h),
      hitsPlayed: 0,
    };
  }

  /** Ends a roll at once: the dice jump to their row. */
  skip(): void {
    const roll = this.#roll;
    if (!roll) return;
    this.#finish(roll);
  }

  dispose(): void {
    this.#renderer.setAnimationLoop(null);
    for (const texture of this.#textures.values()) texture.dispose();
    for (const mesh of this.#dice) mesh.material.forEach((m) => m.dispose());
    this.#geometry.dispose();
    this.#shadow.geometry.dispose();
    this.#shadow.material.dispose();
    this.#renderer.dispose();
  }

  /** The square turn closest to how the die lies, with `face` on top. */
  #squareTurn(face: number, end: { x: number; y: number; z: number; w: number }): Quaternion {
    const [x, y, z] = FACE_NORMALS[face]!;
    const normal = new Vector3(x, y, z);
    const lying = new Quaternion(end.x, end.y, end.z, end.w);
    let best = SQUARE_TURNS[0]!;
    let closest = -1;
    for (const turn of SQUARE_TURNS) {
      if (normal.clone().applyQuaternion(turn).dot(UP) < 0.99) continue;
      const near = Math.abs(turn.dot(lying));
      if (near > closest) {
        closest = near;
        best = turn;
      }
    }
    return best.clone();
  }

  #paint(i: number): void {
    const mesh = this.#dice[i]!;
    mesh.material.forEach((material, face) => {
      // Only the first texture changes the shader; swapping textures later is cheap.
      if (material.map === null) material.needsUpdate = true;
      material.map = this.#textures.get(this.#labels[i]![face]!)!;
    });
  }

  #place(i: number, turn: Quaternion): void {
    const slot = this.#slots[i];
    if (!slot) return;
    const mesh = this.#dice[i]!;
    mesh.position.set(slot.x, 0.5, slot.z);
    mesh.quaternion.copy(turn);
    this.#rest[i] = turn.clone();
  }

  #finish(roll: Roll): void {
    roll.targets.forEach((target, i) => {
      this.#dice[i]!.position.copy(target.position);
      this.#dice[i]!.quaternion.copy(target.turn);
      this.#rest[i] = target.turn.clone();
    });
    this.#roll = null;
  }

  #frame(now: number): void {
    const roll = this.#roll;
    if (roll) this.#animate(roll, now);
    this.#wiggle(now);
    this.#renderer.render(this.#scene, this.#camera);
  }

  #animate(roll: Roll, now: number): void {
    const { frames, hits } = roll.result;
    const elapsed = now - roll.startedAt;
    const index = Math.floor(elapsed / FRAME_SECONDS);

    while (roll.hitsPlayed < hits.length && hits[roll.hitsPlayed]!.frame <= index) {
      this.events.onClack(hits[roll.hitsPlayed]!.strength);
      roll.hitsPlayed++;
    }

    if (index < frames.length) {
      const frame = frames[index]!;
      this.#dice.forEach((mesh, i) => {
        if (!roll.thrown[i]) return;
        const [x, y, z] = frame.positions[i]!;
        const q = frame.turns[i]!;
        mesh.position.set(x, y, z);
        mesh.quaternion.set(q.x, q.y, q.z, q.w);
      });
      return;
    }

    // After the throw the dice glide into their row and lie down square.
    const t = (elapsed - frames.length * FRAME_SECONDS) / GLIDE_SECONDS;
    if (t >= 1) return this.#finish(roll);
    const last = frames.at(-1)!;
    const k = easeOut(t);
    this.#dice.forEach((mesh, i) => {
      if (!roll.thrown[i]) return;
      const [x, y, z] = last.positions[i]!;
      const q = last.turns[i]!;
      mesh.position.set(x, y, z).lerp(roll.targets[i]!.position, k);
      mesh.quaternion.set(q.x, q.y, q.z, q.w).slerp(roll.targets[i]!.turn, k);
    });
  }

  /** Held dice give a little wiggle now and then. */
  #wiggle(now: number): void {
    if (this.#roll) return;
    const phase = (now % 1.2) / 1.2;
    const angle = phase > 0.6 ? Math.sin((phase - 0.6) * Math.PI * 5) * 0.12 : 0;
    const wiggle = new Quaternion().setFromAxisAngle(UP, angle);
    this.#dice.forEach((mesh, i) => {
      const rest = this.#rest[i]!;
      if (this.#held[i]) mesh.quaternion.copy(rest).premultiply(wiggle);
      else mesh.quaternion.copy(rest);
    });
  }
}
