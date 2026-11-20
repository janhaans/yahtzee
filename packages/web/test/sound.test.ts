import { describe, expect, it, vi } from 'vitest';
import { soundsFor } from '../src/fun/sounds';
import { SoundEngine } from '../src/sound/engine';

describe('soundsFor', () => {
  const scored = (points: number, extra = {}) =>
    ({
      kind: 'scored',
      seat: 0,
      box: 'chance',
      points,
      upperBonus: false,
      yahtzeeBonus: false,
      ...extra,
    }) as const;

  it('gives every event its sound', () => {
    const dice = [1, 2, 3, 4, 5] as const;
    const held = [false, false, false, false, false] as const;
    const rolled = { kind: 'rolled', seat: 0, dice, held, roll: 1, yahtzee: false } as const;
    expect(soundsFor({ kind: 'newGame' })).toEqual([]);
    expect(soundsFor({ kind: 'turn', seat: 1 })).toEqual(['turn']);
    expect(soundsFor({ kind: 'held', seat: 0, index: 2, held: true })).toEqual(['hold']);
    expect(soundsFor(rolled)).toEqual([]);
    expect(soundsFor({ ...rolled, yahtzee: true })).toEqual(['yahtzee']);
    expect(soundsFor(scored(20))).toEqual(['score']);
    expect(soundsFor(scored(0))).toEqual(['zero']);
    expect(soundsFor(scored(12, { upperBonus: true }))).toEqual(['bonus']);
    expect(soundsFor(scored(30, { yahtzeeBonus: true }))).toEqual(['bonus']);
    expect(soundsFor({ kind: 'gameOver', winners: ['a'] })).toEqual(['win']);
  });
});

/** Just enough of the Web Audio API to see what the engine schedules. */
function fakeAudio() {
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const node = (): Record<string, unknown> => {
    const n: Record<string, unknown> = {
      gain: param(),
      frequency: param(),
      Q: param(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    n.connect = vi.fn(() => n);
    return n;
  };
  const sources: Record<string, unknown>[] = [];
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    createGain: vi.fn(node),
    createOscillator: vi.fn(node),
    createBiquadFilter: vi.fn(node),
    createBufferSource: vi.fn(() => {
      const source = node();
      sources.push(source);
      return source;
    }),
    createBuffer: (_channels: number, length: number) => ({
      sampleRate: 8000,
      getChannelData: () => new Float32Array(length),
    }),
    decodeAudioData: vi.fn(async (data: ArrayBuffer) => {
      if (data.byteLength === 0) throw new Error('not audio');
      return { recording: true };
    }),
  };
  return { ctx, sources };
}

/** A server with only these sound files; anything else is the web page (not audio). */
function files(...present: string[]): typeof fetch {
  return vi.fn(async (url: string | URL | Request) => {
    const found = present.includes(String(url));
    return {
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(found ? 8 : 0),
    } as Response;
  }) as unknown as typeof fetch;
}

async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe('SoundEngine', () => {
  it('stays quiet until the first tap, then plays', async () => {
    const { ctx } = fakeAudio();
    const engine = new SoundEngine(() => ctx as unknown as AudioContext, files());
    engine.play('roll', 'snoep');
    expect(ctx.createOscillator).not.toHaveBeenCalled();

    engine.unlock();
    await settle();
    expect(ctx.resume).toHaveBeenCalled();
    engine.play('roll', 'snoep');
    engine.clack('voetbal', 0.5);
    expect(ctx.createOscillator).toHaveBeenCalled();
  });

  it('plays nothing while muted, on every device separately', async () => {
    const { ctx } = fakeAudio();
    const engine = new SoundEngine(() => ctx as unknown as AudioContext, files());
    engine.setMuted(true);
    engine.unlock();
    await settle();
    expect(engine.muted).toBe(true);
    for (const name of [
      'roll',
      'hold',
      'score',
      'zero',
      'bonus',
      'turn',
      'yahtzee',
      'win',
    ] as const) {
      engine.play(name, 'voetbal');
    }
    expect(ctx.createOscillator).not.toHaveBeenCalled();

    engine.setMuted(false);
    engine.play('hold', 'voetbal');
    expect(ctx.createOscillator).toHaveBeenCalled();
  });

  it('plays every sound in both themes', async () => {
    const { ctx } = fakeAudio();
    const engine = new SoundEngine(() => ctx as unknown as AudioContext, files());
    engine.unlock();
    await settle();
    for (const theme of ['voetbal', 'snoep'] as const) {
      for (const name of [
        'roll',
        'hold',
        'score',
        'zero',
        'bonus',
        'turn',
        'yahtzee',
        'win',
      ] as const) {
        const before =
          ctx.createOscillator.mock.calls.length + ctx.createBufferSource.mock.calls.length;
        engine.play(name, theme);
        const after =
          ctx.createOscillator.mock.calls.length + ctx.createBufferSource.mock.calls.length;
        expect(after, `${theme} ${name}`).toBeGreaterThan(before);
      }
    }
  });

  it('uses the soccer recordings when they are there, otherwise a made-up sound', async () => {
    const { ctx, sources } = fakeAudio();
    const load = files('/sounds/goal.ogg');
    const engine = new SoundEngine(() => ctx as unknown as AudioContext, load);
    engine.unlock();
    await settle();
    expect(load).toHaveBeenCalledWith('/sounds/crowd-roar.wav');

    engine.play('yahtzee', 'voetbal');
    const recordings = sources.filter((s) => (s.buffer as { recording?: boolean })?.recording);
    expect(recordings).toHaveLength(1); // "GOOOAL!" from the file; the crowd is made up.
  });

  it('keeps quiet when the device has no Web Audio', () => {
    const engine = new SoundEngine(() => {
      throw new Error('no audio');
    }, files());
    engine.unlock();
    expect(() => engine.play('win', 'snoep')).not.toThrow();
  });
});
