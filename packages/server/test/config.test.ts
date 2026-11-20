import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.js';
import { createRng, seededRng } from '../src/rng.js';

describe('readConfig', () => {
  it('uses development defaults', () => {
    expect(readConfig({})).toEqual({
      port: 3000,
      host: '127.0.0.1',
      serveWeb: false,
      seed: null,
      dbPath: resolve(import.meta.dirname, '../../../data/yahtzee.db'),
      joinPort: 3000,
      publicUrl: null,
    });
  });

  it('listens on the home network and serves the web app in production', () => {
    expect(readConfig({ NODE_ENV: 'production' })).toMatchObject({
      host: '0.0.0.0',
      serveWeb: true,
    });
  });

  it('reads port, host and SERVE_WEB', () => {
    expect(readConfig({ PORT: '3100', HOST: '0.0.0.0', SERVE_WEB: '1' })).toMatchObject({
      port: 3100,
      host: '0.0.0.0',
      serveWeb: true,
    });
    expect(readConfig({ PORT: 'abc' }).port).toBe(3000);
  });

  it('uses YAHTZEE_SEED in development and tests', () => {
    expect(readConfig({ YAHTZEE_SEED: '42' }).seed).toBe(42);
    expect(readConfig({ NODE_ENV: 'test', YAHTZEE_SEED: '0' }).seed).toBe(0);
    expect(readConfig({ YAHTZEE_SEED: 'abc' }).seed).toBeNull();
    expect(readConfig({ YAHTZEE_SEED: '' }).seed).toBeNull();
  });

  it('reads the database file from YAHTZEE_DB', () => {
    expect(readConfig({ YAHTZEE_DB: '/tmp/test.db' }).dbPath).toBe('/tmp/test.db');
  });

  it('reads the port and fixed address for phones', () => {
    expect(readConfig({ PORT: '3100' }).joinPort).toBe(3100);
    expect(readConfig({ PORT: '3100', JOIN_PORT: '5173' }).joinPort).toBe(5173);
    expect(readConfig({ JOIN_PORT: 'x' }).joinPort).toBe(3000);
    expect(readConfig({ PUBLIC_URL: 'http://laptop.local:3000' }).publicUrl).toBe(
      'http://laptop.local:3000',
    );
    expect(readConfig({ PUBLIC_URL: 'laptop' }).publicUrl).toBeNull();
  });

  it('ignores YAHTZEE_SEED in production', () => {
    expect(readConfig({ NODE_ENV: 'production', YAHTZEE_SEED: '42' }).seed).toBeNull();
  });
});

describe('rng', () => {
  it('gives the same numbers for the same seed', () => {
    const a = seededRng(7);
    const b = seededRng(7);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(seededRng(8)()).not.toBe(first[0]);
  });

  it('uses Math.random without a seed', () => {
    expect(createRng(null)).toBe(Math.random);
    expect(createRng(7)()).toBe(seededRng(7)());
  });
});
