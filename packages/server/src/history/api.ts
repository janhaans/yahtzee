import type { BoxId, GameStatus, PlayerType } from '@yahtzee/game-logic';

/**
 * Shapes of the history REST API (`/api/...`), shared with the web app.
 * All times are ISO-8601 strings in UTC; the browser shows them in Europe/Amsterdam.
 */

export interface PlayerSummary {
  readonly id: string;
  readonly name: string;
  readonly avatar: string;
  readonly colour: string;
  readonly type: PlayerType;
}

export interface GamePlayerResult extends PlayerSummary {
  readonly seatOrder: number;
  readonly finalScore: number;
  readonly isWinner: boolean;
}

export interface GameListItem {
  readonly id: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  /** Null while the game is in progress. */
  readonly durationSeconds: number | null;
  readonly status: GameStatus;
  readonly roundsPlayed: number;
  readonly theme: string | null;
  readonly topScore: number;
  /** In playing order. */
  readonly players: readonly GamePlayerResult[];
}

export interface GameList {
  readonly items: readonly GameListItem[];
  /** Number of games that match the filters, over all pages. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface GameDetailPlayer extends GamePlayerResult {
  readonly upperTotal: number;
  readonly upperBonus: number;
  readonly lowerTotal: number;
  readonly yahtzeeBonusCount: number;
  /** Points per box; null means the box was never filled (aborted games). */
  readonly scorecard: Readonly<Record<BoxId, number | null>>;
}

export interface GameDetail extends Omit<GameListItem, 'players'> {
  readonly players: readonly GameDetailPlayer[];
}

export interface PlayerStats extends PlayerSummary {
  /** Finished games only; aborted games do not count for wins or scores. */
  readonly gamesPlayed: number;
  readonly gamesWon: number;
  /** 0 to 100, rounded; 0 when no finished games. */
  readonly winPercentage: number;
  readonly highestScore: number | null;
  readonly averageScore: number | null;
  readonly gamesAborted: number;
  /** Yahtzees rolled in all games: a 50 in the Yahtzee box plus every Yahtzee bonus. */
  readonly yahtzees: number;
}

export interface HallOfFameEntry extends PlayerSummary {
  readonly gameId: string;
  readonly startedAt: string;
  readonly score: number;
}

export interface MonthCount {
  /** `yyyy-mm` in Europe/Amsterdam. */
  readonly month: string;
  readonly games: number;
}

export type SortField = 'date' | 'duration' | 'players' | 'score' | 'winner' | 'status';

export interface GameFilter {
  /** `yyyy-mm-dd`, a day in Europe/Amsterdam, inclusive. */
  readonly from?: string;
  readonly to?: string;
  /** Player ids; a game matches when all of them took part. */
  readonly players?: readonly string[];
  /** Player id of a winner. */
  readonly winner?: string;
  readonly status?: GameStatus;
  readonly playerCount?: number;
  /** On the highest score of the game. */
  readonly minScore?: number;
  readonly maxScore?: number;
  readonly sort?: SortField;
  readonly order?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
}
