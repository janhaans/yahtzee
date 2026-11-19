import { randomUUID } from 'node:crypto';
import type { StatementSync } from 'node:sqlite';
import {
  nameKey,
  totals,
  winners,
  type BoxId,
  type Dice,
  type GameState,
  type GameStatus,
  type PlayerType,
} from '@yahtzee/game-logic';
import type {
  GameDetail,
  GameDetailPlayer,
  GameFilter,
  GameList,
  GameListItem,
  GamePlayerResult,
  HallOfFameEntry,
  MonthCount,
  PlayerStats,
  PlayerSummary,
  SortField,
} from './api.js';
import { transaction, type Database } from './db.js';
import { amsterdamMonth, dayStartUtc } from './time.js';

export interface TurnRecord {
  readonly round: number;
  readonly seat: number;
  /** The five dice after each roll of the turn. */
  readonly rolls: readonly Dice[];
  readonly box: BoxId;
  readonly points: number;
  readonly playedAt: string;
}

/**
 * One game as it is now: everything the history needs. Saving the same record twice is
 * harmless, so a save that failed can simply be tried again with a newer record.
 */
export interface GameRecord {
  readonly id: string;
  readonly state: GameState;
  readonly startedAt: string;
  readonly savedAt: string;
  /** Null while the game is in progress. */
  readonly endedAt: string | null;
  readonly theme: string | null;
  /** The dice of each roll so far in the current turn, to continue the turn after a restart. */
  readonly turnRolls: readonly Dice[];
  /** Turns that may not be in the database yet; turns already saved are skipped. */
  readonly turns: readonly TurnRecord[];
}

/** A game that was still in progress when the server stopped. */
export interface SavedGame {
  readonly id: string;
  readonly state: GameState;
  readonly startedAt: string;
  readonly savedAt: string;
  readonly turnRolls: readonly Dice[];
}

/** What the game room needs from the history. */
export interface GameHistory {
  save(record: GameRecord): void;
  /** The newest unfinished game; older unfinished games are marked aborted. */
  findUnfinished(): SavedGame | null;
}

interface Snapshot {
  readonly v: 1;
  readonly state: GameState;
  readonly turnRolls: readonly Dice[];
}

export const DEFAULT_PAGE_SIZE = 25;

const SORT_COLUMNS: Record<SortField, string> = {
  date: 'started_at',
  duration: 'duration_seconds',
  players: 'player_count',
  score: 'top_score',
  winner: 'winner_name COLLATE NOCASE',
  status: 'status',
};

/** One row per game, with the values the list can filter and sort on. */
const GAMES = `
  SELECT g.id, g.started_at, g.ended_at, g.status, g.rounds_played, g.theme,
    CASE WHEN g.ended_at IS NULL THEN NULL
      ELSE CAST(ROUND((julianday(g.ended_at) - julianday(g.started_at)) * 86400) AS INTEGER)
    END AS duration_seconds,
    (SELECT MAX(final_score) FROM game_players gp WHERE gp.game_id = g.id) AS top_score,
    (SELECT COUNT(*) FROM game_players gp WHERE gp.game_id = g.id) AS player_count,
    (SELECT MIN(p.name) FROM game_players gp JOIN players p ON p.id = gp.player_id
      WHERE gp.game_id = g.id AND gp.is_winner = 1) AS winner_name
  FROM games g`;

const GAME_PLAYERS = `
  SELECT gp.game_id, gp.seat_order, gp.upper_total, gp.upper_bonus, gp.lower_total,
    gp.yahtzee_bonus_count, gp.final_score, gp.is_winner, gp.scorecard,
    p.id, p.name, p.avatar, p.colour, p.type
  FROM game_players gp JOIN players p ON p.id = gp.player_id`;

interface GameRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: GameStatus;
  rounds_played: number;
  theme: string | null;
  duration_seconds: number | null;
  top_score: number;
}

interface PlayerRow {
  id: string;
  name: string;
  avatar: string;
  colour: string;
  type: PlayerType;
}

interface GamePlayerRow extends PlayerRow {
  game_id: string;
  seat_order: number;
  upper_total: number;
  upper_bonus: number;
  lower_total: number;
  yahtzee_bonus_count: number;
  final_score: number;
  is_winner: number;
  scorecard: string;
}

function toPlayer(row: PlayerRow): PlayerSummary {
  return { id: row.id, name: row.name, avatar: row.avatar, colour: row.colour, type: row.type };
}

function toResult(row: GamePlayerRow): GamePlayerResult {
  return {
    ...toPlayer(row),
    seatOrder: row.seat_order,
    finalScore: row.final_score,
    isWinner: row.is_winner === 1,
  };
}

function toDetailPlayer(row: GamePlayerRow): GameDetailPlayer {
  return {
    ...toResult(row),
    upperTotal: row.upper_total,
    upperBonus: row.upper_bonus,
    lowerTotal: row.lower_total,
    yahtzeeBonusCount: row.yahtzee_bonus_count,
    scorecard: JSON.parse(row.scorecard) as GameDetailPlayer['scorecard'],
  };
}

function toGame(row: GameRow): Omit<GameListItem, 'players'> {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    status: row.status,
    roundsPlayed: row.rounds_played,
    theme: row.theme,
    topScore: row.top_score,
  };
}

function parseSnapshot(json: string): Snapshot | null {
  try {
    const snapshot = JSON.parse(json) as Partial<Snapshot> | null;
    if (snapshot?.v !== 1 || snapshot.state?.status !== 'in_progress') return null;
    return snapshot as Snapshot;
  } catch {
    return null;
  }
}

/** Builds the WHERE clause for the game list. Values are always bound, never pasted in. */
function whereClause(filter: GameFilter): { sql: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  const add = (condition: string, ...values: (string | number)[]) => {
    conditions.push(condition);
    params.push(...values);
  };

  if (filter.from) add('started_at >= ?', dayStartUtc(filter.from));
  if (filter.to) add('started_at < ?', dayStartUtc(filter.to, 1));
  for (const player of filter.players ?? []) {
    add('EXISTS (SELECT 1 FROM game_players WHERE game_id = list.id AND player_id = ?)', player);
  }
  if (filter.winner) {
    add(
      'EXISTS (SELECT 1 FROM game_players WHERE game_id = list.id AND player_id = ? AND is_winner = 1)',
      filter.winner,
    );
  }
  if (filter.status) add('status = ?', filter.status);
  if (filter.playerCount !== undefined) add('player_count = ?', filter.playerCount);
  if (filter.minScore !== undefined) add('top_score >= ?', filter.minScore);
  if (filter.maxScore !== undefined) add('top_score <= ?', filter.maxScore);

  return { sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

/** The game history in SQLite: saving games, and the queries the dashboard needs. */
export class HistoryStore implements GameHistory {
  readonly #db: Database;
  readonly #upsertPlayer: StatementSync;
  readonly #upsertGame: StatementSync;
  readonly #upsertGamePlayer: StatementSync;
  readonly #insertTurn: StatementSync;

  constructor(db: Database) {
    this.#db = db;
    this.#upsertPlayer = db.prepare(`
      INSERT INTO players (id, name, name_key, avatar, colour, type, created_at, last_played_at)
      VALUES (:id, :name, :key, :avatar, :colour, :type, :now, :now)
      ON CONFLICT (name_key) DO UPDATE SET
        name = excluded.name, avatar = excluded.avatar, colour = excluded.colour,
        type = excluded.type, last_played_at = MAX(last_played_at, excluded.last_played_at)
      RETURNING id`);
    this.#upsertGame = db.prepare(`
      INSERT INTO games
        (id, started_at, ended_at, last_saved_at, status, rounds_played, theme, state_json)
      VALUES (:id, :startedAt, :endedAt, :savedAt, :status, :rounds, :theme, :state)
      ON CONFLICT (id) DO UPDATE SET
        ended_at = excluded.ended_at, last_saved_at = excluded.last_saved_at,
        status = excluded.status, rounds_played = excluded.rounds_played,
        theme = excluded.theme, state_json = excluded.state_json`);
    this.#upsertGamePlayer = db.prepare(`
      INSERT INTO game_players (game_id, player_id, seat_order, upper_total, upper_bonus,
        lower_total, yahtzee_bonus_count, final_score, is_winner, scorecard)
      VALUES (:gameId, :playerId, :seat, :upperTotal, :upperBonus, :lowerTotal,
        :yahtzeeBonusCount, :finalScore, :isWinner, :scorecard)
      ON CONFLICT (game_id, seat_order) DO UPDATE SET
        player_id = excluded.player_id, upper_total = excluded.upper_total,
        upper_bonus = excluded.upper_bonus, lower_total = excluded.lower_total,
        yahtzee_bonus_count = excluded.yahtzee_bonus_count,
        final_score = excluded.final_score, is_winner = excluded.is_winner,
        scorecard = excluded.scorecard`);
    this.#insertTurn = db.prepare(`
      INSERT OR IGNORE INTO turns
        (game_id, round, seat_order, player_id, rolls, box, points, played_at)
      VALUES (:gameId, :round, :seat, :playerId, :rolls, :box, :points, :playedAt)`);
  }

  save(record: GameRecord): void {
    const { state } = record;
    const winnerIds = new Set(winners(state));
    const snapshot: Snapshot = { v: 1, state, turnRolls: record.turnRolls };

    transaction(this.#db, () => {
      const playerIds = state.players.map((player) => {
        const row = this.#upsertPlayer.get({
          id: randomUUID(),
          name: player.name,
          key: nameKey(player.name),
          avatar: player.avatar,
          colour: player.colour,
          type: player.type,
          now: record.savedAt,
        }) as { id: string };
        return row.id;
      });

      this.#upsertGame.run({
        id: record.id,
        startedAt: record.startedAt,
        endedAt: record.endedAt,
        savedAt: record.savedAt,
        status: state.status,
        rounds: state.round,
        theme: record.theme,
        state: JSON.stringify(snapshot),
      });

      state.scorecards.forEach((card, seat) => {
        const t = totals(card);
        this.#upsertGamePlayer.run({
          gameId: record.id,
          playerId: playerIds[seat]!,
          seat,
          upperTotal: t.upperTotal,
          upperBonus: t.upperBonus,
          lowerTotal: t.lowerTotal,
          yahtzeeBonusCount: card.yahtzeeBonusCount,
          finalScore: t.grandTotal,
          isWinner: winnerIds.has(state.players[seat]!.id) ? 1 : 0,
          scorecard: JSON.stringify(card.boxes),
        });
      });

      for (const turn of record.turns) {
        this.#insertTurn.run({
          gameId: record.id,
          round: turn.round,
          seat: turn.seat,
          playerId: playerIds[turn.seat]!,
          rolls: JSON.stringify(turn.rolls),
          box: turn.box,
          points: turn.points,
          playedAt: turn.playedAt,
        });
      }
    });
  }

  findUnfinished(): SavedGame | null {
    const rows = this.#db
      .prepare(
        `SELECT id, started_at, last_saved_at, state_json FROM games
         WHERE status = 'in_progress' ORDER BY last_saved_at DESC`,
      )
      .all() as { id: string; started_at: string; last_saved_at: string; state_json: string }[];
    const abort = this.#db.prepare(
      `UPDATE games SET status = 'aborted', ended_at = last_saved_at WHERE id = ?`,
    );

    return transaction(this.#db, () => {
      let found: SavedGame | null = null;
      for (const row of rows) {
        const snapshot: Snapshot | null = found ? null : parseSnapshot(row.state_json);
        if (snapshot) {
          found = {
            id: row.id,
            state: snapshot.state,
            startedAt: row.started_at,
            savedAt: row.last_saved_at,
            turnRolls: snapshot.turnRolls,
          };
        } else {
          // An older (or unreadable) unfinished game can never be continued: it was abandoned.
          abort.run(row.id);
        }
      }
      return found;
    });
  }

  listGames(filter: GameFilter = {}): GameList {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = whereClause(filter);
    const sort = SORT_COLUMNS[filter.sort ?? 'date'];
    const order = filter.order === 'asc' ? 'ASC' : 'DESC';

    const { total } = this.#db
      .prepare(`SELECT COUNT(*) AS total FROM (${GAMES}) AS list ${where.sql}`)
      .get(...where.params) as { total: number };
    const rows = this.#db
      .prepare(
        `SELECT * FROM (${GAMES}) AS list ${where.sql}
         ORDER BY ${sort} ${order} NULLS LAST, started_at DESC, id
         LIMIT ? OFFSET ?`,
      )
      .all(...where.params, pageSize, (page - 1) * pageSize) as unknown as GameRow[];

    const players = this.#playersOf(rows.map((row) => row.id));
    const items = rows.map((row) => ({
      ...toGame(row),
      players: players.filter((p) => p.game_id === row.id).map(toResult),
    }));
    return { items, total, page, pageSize };
  }

  getGame(id: string): GameDetail | null {
    const row = this.#db.prepare(`SELECT * FROM (${GAMES}) AS list WHERE id = ?`).get(id) as
      GameRow | undefined;
    if (!row) return null;
    return { ...toGame(row), players: this.#playersOf([id]).map(toDetailPlayer) };
  }

  /** Deletes a finished or aborted game. A game in progress cannot be deleted. */
  deleteGame(id: string): 'deleted' | 'not_found' | 'in_progress' {
    const row = this.#db.prepare('SELECT status FROM games WHERE id = ?').get(id) as
      { status: GameStatus } | undefined;
    if (!row) return 'not_found';
    if (row.status === 'in_progress') return 'in_progress';
    this.#db.prepare('DELETE FROM games WHERE id = ?').run(id);
    return 'deleted';
  }

  /** Everyone who ever played, by name. */
  listPlayers(): PlayerSummary[] {
    const rows = this.#db
      .prepare('SELECT * FROM players ORDER BY name COLLATE NOCASE')
      .all() as unknown as PlayerRow[];
    return rows.map(toPlayer);
  }

  /** The players who played most recently first, for quick setup. */
  recentPlayers(limit: number): PlayerSummary[] {
    const rows = this.#db
      .prepare('SELECT * FROM players ORDER BY last_played_at DESC, name COLLATE NOCASE LIMIT ?')
      .all(limit) as unknown as PlayerRow[];
    return rows.map(toPlayer);
  }

  playerStats(): PlayerStats[] {
    const rows = this.#db
      .prepare(
        `SELECT p.id, p.name, p.avatar, p.colour, p.type,
          COUNT(CASE WHEN g.status = 'finished' THEN 1 END) AS games_played,
          COUNT(CASE WHEN g.status = 'finished' AND gp.is_winner = 1 THEN 1 END) AS games_won,
          MAX(CASE WHEN g.status = 'finished' THEN gp.final_score END) AS highest_score,
          AVG(CASE WHEN g.status = 'finished' THEN gp.final_score END) AS average_score,
          COUNT(CASE WHEN g.status = 'aborted' THEN 1 END) AS games_aborted,
          SUM((json_extract(gp.scorecard, '$.yahtzee') IS 50) + gp.yahtzee_bonus_count)
            AS yahtzees
        FROM players p
        JOIN game_players gp ON gp.player_id = p.id
        JOIN games g ON g.id = gp.game_id
        GROUP BY p.id
        ORDER BY games_won DESC, games_played DESC, p.name COLLATE NOCASE`,
      )
      .all() as unknown as (PlayerRow & {
      games_played: number;
      games_won: number;
      highest_score: number | null;
      average_score: number | null;
      games_aborted: number;
      yahtzees: number;
    })[];

    return rows.map((row) => ({
      ...toPlayer(row),
      gamesPlayed: row.games_played,
      gamesWon: row.games_won,
      winPercentage: row.games_played ? Math.round((row.games_won / row.games_played) * 100) : 0,
      highestScore: row.highest_score,
      averageScore: row.average_score === null ? null : Math.round(row.average_score),
      gamesAborted: row.games_aborted,
      yahtzees: row.yahtzees,
    }));
  }

  /** The highest scores ever, in finished games. */
  hallOfFame(limit = 10): HallOfFameEntry[] {
    const rows = this.#db
      .prepare(
        `SELECT p.id, p.name, p.avatar, p.colour, p.type,
          g.id AS game_id, g.started_at, gp.final_score
        FROM game_players gp
        JOIN games g ON g.id = gp.game_id
        JOIN players p ON p.id = gp.player_id
        WHERE g.status = 'finished'
        ORDER BY gp.final_score DESC, g.started_at
        LIMIT ?`,
      )
      .all(limit) as unknown as (PlayerRow & {
      game_id: string;
      started_at: string;
      final_score: number;
    })[];

    return rows.map((row) => ({
      ...toPlayer(row),
      gameId: row.game_id,
      startedAt: row.started_at,
      score: row.final_score,
    }));
  }

  /** Number of games started per month (Amsterdam time), oldest month first. */
  gamesPerMonth(): MonthCount[] {
    const rows = this.#db.prepare('SELECT started_at FROM games').all() as {
      started_at: string;
    }[];
    const counts = new Map<string, number>();
    for (const row of rows) {
      const month = amsterdamMonth(row.started_at);
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
    return [...counts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, games]) => ({ month, games }));
  }

  #playersOf(gameIds: readonly string[]): GamePlayerRow[] {
    return this.#db
      .prepare(
        `${GAME_PLAYERS} WHERE gp.game_id IN (SELECT value FROM json_each(?))
         ORDER BY gp.seat_order`,
      )
      .all(JSON.stringify(gameIds)) as unknown as GamePlayerRow[];
  }
}
