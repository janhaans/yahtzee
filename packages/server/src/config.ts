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
  /** The port phones open; in development that is the Vite port, not the server's. */
  readonly joinPort: number;
  /** A fixed address for the QR code (e.g. http://laptop.local:3000), instead of the found ones. */
  readonly publicUrl: string | null;
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
  const joinPort = Number(env.JOIN_PORT);
  const portOrDefault = Number.isInteger(port) && port > 0 ? port : 3000;

  return {
    port: portOrDefault,
    host: env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1'),
    serveWeb: production || env.SERVE_WEB === '1',
    seed: !production && env.YAHTZEE_SEED && Number.isInteger(seed) ? seed : null,
    dbPath: env.YAHTZEE_DB || DEFAULT_DB_PATH,
    joinPort: Number.isInteger(joinPort) && joinPort > 0 ? joinPort : portOrDefault,
    publicUrl: env.PUBLIC_URL && URL.canParse(env.PUBLIC_URL) ? env.PUBLIC_URL : null,
  };
}
