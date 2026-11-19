import { fileURLToPath } from 'node:url';

/** The history database, in the `data/` folder at the root of the project. */
const DEFAULT_DB_PATH = fileURLToPath(new URL('../../../data/yahtzee.db', import.meta.url));

export interface Config {
  readonly port: number;
  readonly host: string;
  /** Serve the built web app (packages/web/dist) from this server. */
  readonly serveWeb: boolean;
  /** Seed for predictable dice. Only ever set outside production. */
  readonly seed: number | null;
  /** SQLite file with the game history. */
  readonly dbPath: string;
}

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Reads the server settings from environment variables.
 * YAHTZEE_SEED is ignored in production (npm start), so real games always use random dice.
 */
export function readConfig(env: Env): Config {
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT);
  const seed = Number(env.YAHTZEE_SEED);

  return {
    port: Number.isInteger(port) && port > 0 ? port : 3000,
    host: env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1'),
    serveWeb: production || env.SERVE_WEB === '1',
    seed: !production && env.YAHTZEE_SEED && Number.isInteger(seed) ? seed : null,
    dbPath: env.YAHTZEE_DB || DEFAULT_DB_PATH,
  };
}
