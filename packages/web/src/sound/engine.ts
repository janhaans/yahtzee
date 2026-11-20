import type { ThemeId } from '@yahtzee/server/looks';
import type { SoundName } from '../fun/sounds';
import { clack, crowd, horn, synth } from './synth';

/** Recordings that may be put in packages/web/public/sounds/ (see the README there). */
type Recording = 'crowd-roar' | 'goal';
const RECORDINGS: readonly Recording[] = ['crowd-roar', 'goal'];
const EXTENSIONS = ['mp3', 'ogg', 'wav'];

/**
 * Plays the game sounds on this device. Browsers (iPhones most of all) only allow sound after
 * a tap, so `unlock()` is called on every tap; until then sounds are skipped. iOS also stops
 * the sound again when the screen locks or a call comes in (state "interrupted"); the next
 * tap starts it again.
 */
export class SoundEngine {
  #ctx: AudioContext | null = null;
  #master: GainNode | null = null;
  #muted = false;
  /** A decoded recording, null when it is missing, absent while it is still loading. */
  readonly #recordings = new Map<Recording, AudioBuffer | null>();
  readonly #listeners = new Set<() => void>();

  constructor(
    private readonly createContext: () => AudioContext = () => new AudioContext(),
    private readonly load: typeof fetch = (...args) => fetch(...args),
  ) {}

  get muted(): boolean {
    return this.#muted;
  }

  setMuted(muted: boolean): void {
    this.#muted = muted;
    if (this.#master) this.#master.gain.value = muted ? 0 : 1;
  }

  /** True until sound may play: before the first tap, and after iOS interrupted it. */
  get locked(): boolean {
    return this.#ctx?.state !== 'running';
  }

  /** Calls `listener` when `locked` may have changed. Returns a function to stop. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Must be called from inside a tap, click or key handler, or the browser says no. */
  unlock(): void {
    if (!this.#ctx) {
      let ctx: AudioContext;
      try {
        ctx = this.createContext();
      } catch {
        return; // No Web Audio: the game simply stays quiet.
      }
      this.#ctx = ctx;
      ctx.onstatechange = () => this.#changed();
      playThroughSilentSwitch();
      this.#master = ctx.createGain();
      this.#master.gain.value = this.#muted ? 0 : 1;
      this.#master.connect(ctx.destination);
      for (const recording of RECORDINGS) void this.#loadRecording(ctx, recording);
    }
    const ctx = this.#ctx;
    // "suspended" before the first tap; "interrupted" on iOS after a lock screen or a call.
    if (ctx.state !== 'running' && ctx.state !== 'closed') {
      void ctx.resume().then(
        () => this.#changed(),
        () => {}, // Not allowed yet: the next tap tries again.
      );
      // Older iPhones only really start after a sound is played inside the tap itself.
      const silence = ctx.createBufferSource();
      silence.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      silence.connect(ctx.destination);
      silence.start(0);
    }
    this.#changed();
  }

  #changed(): void {
    for (const listener of this.#listeners) listener();
  }

  play(name: SoundName, theme: ThemeId): void {
    const out = this.#output();
    if (!out) return;
    const { ctx, master, at } = out;
    synth(name, theme, ctx, master, at);
    if (theme !== 'voetbal') return;
    if (name === 'yahtzee') {
      this.#playRecording('goal', at, () => horn(ctx, master, at));
      this.#playRecording('crowd-roar', at + 0.3, () => crowd(ctx, master, at + 0.3));
    } else if (name === 'win') {
      this.#playRecording('crowd-roar', at + 0.3, () => crowd(ctx, master, at + 0.3, 3));
    }
  }

  /** One die hitting the table or another die, for the 3D dice. `strength` is 0 to 1. */
  clack(theme: ThemeId, strength: number): void {
    const out = this.#output();
    if (out) clack(out.ctx, out.master, out.at, theme, strength);
  }

  #output() {
    const ctx = this.#ctx;
    const master = this.#master;
    if (this.#muted || !ctx || !master || ctx.state !== 'running') return null;
    return { ctx, master, at: ctx.currentTime + 0.01 };
  }

  #playRecording(recording: Recording, at: number, fallback: () => void): void {
    const buffer = this.#recordings.get(recording);
    if (!buffer) return fallback();
    const source = this.#ctx!.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#master!);
    source.start(at);
  }

  async #loadRecording(ctx: AudioContext, recording: Recording): Promise<void> {
    for (const extension of EXTENSIONS) {
      try {
        const response = await this.load(`/sounds/${recording}.${extension}`);
        if (!response.ok) continue;
        // A missing file may come back as the web page; decoding then fails and we go on.
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        this.#recordings.set(recording, buffer);
        return;
      } catch {
        // Try the next file type.
      }
    }
    this.#recordings.set(recording, null);
  }
}

/**
 * An iPhone mutes web sound when its ring/silent switch is on. The game has its own mute
 * button on every phone, so it asks for the "playback" audio session (Safari 16.4+), which
 * plays anyway. Other browsers do not have this and are not affected.
 */
function playThroughSilentSwitch(): void {
  const session = (globalThis.navigator as { audioSession?: { type: string } } | undefined)
    ?.audioSession;
  if (session) session.type = 'playback';
}

/** The one sound engine of this page. */
export const sound = new SoundEngine();
