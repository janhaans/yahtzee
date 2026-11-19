import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

/**
 * Schema changes, in order. The database remembers how many have run (PRAGMA user_version),
 * so later milestones only append a new entry here.
 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    -- Normalized lower-case name: the same name is the same player.
    name_key TEXT NOT NULL UNIQUE,
    avatar TEXT NOT NULL,
    colour TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('human', 'computer')),
    created_at TEXT NOT NULL,
    last_played_at TEXT NOT NULL
  );

  CREATE TABLE games (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    last_saved_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'finished', 'aborted')),
    rounds_played INTEGER NOT NULL,
    theme TEXT,
    -- Snapshot of the game, so an unfinished game can be continued after a restart.
    state_json TEXT NOT NULL
  );
  CREATE INDEX games_started_at ON games (started_at);
  CREATE INDEX games_status ON games (status);

  CREATE TABLE game_players (
    game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players (id),
    seat_order INTEGER NOT NULL,
    upper_total INTEGER NOT NULL,
    upper_bonus INTEGER NOT NULL,
    lower_total INTEGER NOT NULL,
    yahtzee_bonus_count INTEGER NOT NULL,
    final_score INTEGER NOT NULL,
    is_winner INTEGER NOT NULL,
    -- JSON object with all 13 boxes; null for a box that is still empty.
    scorecard TEXT NOT NULL,
    PRIMARY KEY (game_id, seat_order)
  );
  CREATE INDEX game_players_player ON game_players (player_id);

  CREATE TABLE turns (
    game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    seat_order INTEGER NOT NULL,
    player_id TEXT NOT NULL REFERENCES players (id),
    -- JSON array with the five dice after each roll.
    rolls TEXT NOT NULL,
    box TEXT NOT NULL,
    points INTEGER NOT NULL,
    played_at TEXT NOT NULL,
    PRIMARY KEY (game_id, round, seat_order)
  );
  `,
];

/** Opens (and creates, if needed) the history database and brings its schema up to date. */
export function openDatabase(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 2000;');
  migrate(db);
  return db;
}

function migrate(db: Database): void {
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  MIGRATIONS.slice(version).forEach((sql, i) =>
    transaction(db, () => {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version + i + 1}`);
    }),
  );
}

/** Runs `work` in one transaction: everything is saved, or nothing is. */
export function transaction<T>(db: Database, work: () => T): T {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
