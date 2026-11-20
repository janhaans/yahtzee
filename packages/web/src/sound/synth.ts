import type { ThemeId } from '@yahtzee/server/looks';
import type { SoundName } from '../fun/sounds';

/**
 * Sounds made with the Web Audio API: no files needed. Every function schedules its notes
 * from `at` (seconds on the audio clock) into `out`.
 */

interface Tone {
  freq: number;
  /** Glide to this frequency by the end. */
  to?: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
}

function tone(ctx: BaseAudioContext, out: AudioNode, at: number, t: Tone): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = at + t.start;
  const end = start + t.duration;
  osc.type = t.type ?? 'triangle';
  osc.frequency.setValueAtTime(t.freq, start);
  if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(t.volume ?? 0.3, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(end + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;

function noiseSource(ctx: BaseAudioContext): AudioBufferSourceNode {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  return source;
}

interface Noise {
  start: number;
  duration: number;
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  volume: number;
  /** Seconds to fade in; short for a hit, long for a crowd. */
  attack?: number;
}

function noise(ctx: BaseAudioContext, out: AudioNode, at: number, n: Noise): void {
  const source = noiseSource(ctx);
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const start = at + n.start;
  const end = start + n.duration;
  filter.type = n.filter;
  filter.frequency.value = n.freq;
  filter.Q.value = n.q ?? 1;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(n.volume, start + (n.attack ?? 0.003));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(filter).connect(gain).connect(out);
  source.start(start, Math.random());
  source.stop(end + 0.05);
}

/**
 * One die hitting something. Footballs on grass give a soft thud; sugar cubes and gummies
 * on a counter give a brighter tick. `strength` is 0 to 1.
 */
export function clack(
  ctx: BaseAudioContext,
  out: AudioNode,
  at: number,
  theme: ThemeId,
  strength = 1,
): void {
  const volume = 0.05 + 0.35 * Math.min(1, Math.max(0, strength));
  if (theme === 'voetbal') {
    noise(ctx, out, at, { start: 0, duration: 0.07, filter: 'lowpass', freq: 900, volume });
    tone(ctx, out, at, { freq: 140, to: 70, start: 0, duration: 0.08, type: 'sine', volume });
  } else {
    noise(ctx, out, at, { start: 0, duration: 0.04, filter: 'bandpass', freq: 3200, q: 3, volume });
    tone(ctx, out, at, { freq: 1700, start: 0, duration: 0.03, type: 'sine', volume: volume / 3 });
  }
}

/** Dice rattling and tumbling for about half a second. */
function roll(ctx: BaseAudioContext, out: AudioNode, at: number, theme: ThemeId): void {
  for (let i = 0; i < 9; i++) {
    const start = i * 0.06 + Math.random() * 0.03;
    clack(ctx, out, at + start, theme, 1 - i / 10);
  }
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;

function notes(
  ctx: BaseAudioContext,
  out: AudioNode,
  at: number,
  melody: readonly (readonly [number, number, number])[],
  type: OscillatorType,
  volume = 0.25,
): void {
  for (const [freq, start, duration] of melody) {
    tone(ctx, out, at, { freq, start, duration, type, volume });
  }
}

/** A stadium crowd swelling up and dying down. Used when no recording is available. */
export function crowd(ctx: BaseAudioContext, out: AudioNode, at: number, seconds = 2.5): void {
  for (const freq of [500, 900, 1400]) {
    noise(ctx, out, at, {
      start: 0,
      duration: seconds,
      filter: 'bandpass',
      freq,
      q: 0.8,
      volume: 0.18,
      attack: 0.4,
    });
  }
}

/** A stadium horn blast, used when there is no "GOOOAL!" recording. */
export function horn(ctx: BaseAudioContext, out: AudioNode, at: number): void {
  for (const freq of [233, 294, 349]) {
    tone(ctx, out, at, { freq, start: 0, duration: 1.1, type: 'sawtooth', volume: 0.08 });
  }
}

/** A happy candy-shop jingle with sparkles. */
function jingle(ctx: BaseAudioContext, out: AudioNode, at: number): void {
  notes(
    ctx,
    out,
    at,
    [
      [C6, 0, 0.12],
      [E6, 0.12, 0.12],
      [G6, 0.24, 0.12],
      [E6, 0.36, 0.12],
      [G6, 0.48, 0.12],
      [C6 * 2, 0.6, 0.5],
    ],
    'triangle',
  );
  for (let i = 0; i < 8; i++) {
    tone(ctx, out, at, {
      freq: 2500 + Math.random() * 2500,
      start: 0.6 + i * 0.07,
      duration: 0.1,
      type: 'sine',
      volume: 0.06,
    });
  }
}

function fanfare(ctx: BaseAudioContext, out: AudioNode, at: number, type: OscillatorType): void {
  notes(
    ctx,
    out,
    at,
    [
      [G5 / 2, 0, 0.15],
      [C5, 0.15, 0.15],
      [E5, 0.3, 0.15],
      [G5, 0.45, 0.3],
      [E5, 0.8, 0.15],
      [G5, 0.95, 0.8],
    ],
    type,
    0.18,
  );
}

/**
 * Plays the synthesised part of a sound. The soccer crowd and "GOOOAL!" come from recordings
 * when they are there; the engine adds those (falling back to `crowd` and `horn`).
 */
export function synth(
  name: SoundName,
  theme: ThemeId,
  ctx: BaseAudioContext,
  out: AudioNode,
  at: number,
): void {
  const soccer = theme === 'voetbal';
  switch (name) {
    case 'roll':
      return roll(ctx, out, at, theme);
    case 'hold':
      return soccer
        ? tone(ctx, out, at, { freq: 620, start: 0, duration: 0.06, volume: 0.25 })
        : tone(ctx, out, at, { freq: 700, to: 1500, start: 0, duration: 0.09, type: 'sine' });
    case 'score':
      if (soccer) clack(ctx, out, at, theme, 1);
      return notes(
        ctx,
        out,
        at + (soccer ? 0.05 : 0),
        [
          [C5, 0, 0.1],
          [E5, 0.08, 0.1],
          [G5, 0.16, 0.18],
        ],
        soccer ? 'square' : 'triangle',
        soccer ? 0.1 : 0.25,
      );
    case 'zero':
      // A playful "boing", never a sad trombone.
      return tone(ctx, out, at, { freq: 420, to: 180, start: 0, duration: 0.35, type: 'sine' });
    case 'bonus':
      return notes(
        ctx,
        out,
        at,
        [
          [C5, 0, 0.1],
          [E5, 0.08, 0.1],
          [G5, 0.16, 0.1],
          [C6, 0.24, 0.1],
          [E6, 0.32, 0.1],
          [G6, 0.4, 0.3],
        ],
        'triangle',
      );
    case 'turn':
      // A short, soft two-note chime; a little higher in the sweet shop.
      return notes(
        ctx,
        out,
        at,
        soccer
          ? [
              [E5, 0, 0.22],
              [A5, 0.11, 0.26],
            ]
          : [
              [G5, 0, 0.22],
              [C6, 0.11, 0.26],
            ],
        'sine',
        0.08,
      );
    case 'yahtzee':
      return soccer ? undefined : jingle(ctx, out, at);
    case 'win':
      fanfare(ctx, out, at, soccer ? 'square' : 'triangle');
      return soccer ? undefined : jingle(ctx, out, at + 1.6);
  }
}
