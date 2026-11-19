import type { FastifyInstance } from 'fastify';
import type { GameFilter, SortField } from './api.js';
import { DEFAULT_PAGE_SIZE, type HistoryStore } from './store.js';

const DAY = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } as const;
const SCORE = { type: 'integer', minimum: 0 } as const;
const SORT_FIELDS: readonly SortField[] = [
  'date',
  'duration',
  'players',
  'score',
  'winner',
  'status',
];

const gameListQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    from: DAY,
    to: DAY,
    // Repeat to select several players: ?player=a&player=b (games where all of them played).
    player: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    winner: { type: 'string' },
    status: { type: 'string', enum: ['in_progress', 'finished', 'aborted'] },
    playerCount: { type: 'integer', minimum: 2, maximum: 4 },
    minScore: SCORE,
    maxScore: SCORE,
    sort: { type: 'string', enum: SORT_FIELDS },
    order: { type: 'string', enum: ['asc', 'desc'] },
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: DEFAULT_PAGE_SIZE },
  },
} as const;

type GameListQuery = Omit<GameFilter, 'players'> & { player?: string[] };

const idParams = {
  type: 'object',
  properties: { id: { type: 'string' } },
  required: ['id'],
} as const;

const limitQuery = (max: number, fallback: number) =>
  ({
    type: 'object',
    additionalProperties: false,
    properties: { limit: { type: 'integer', minimum: 1, maximum: max, default: fallback } },
  }) as const;

/** The history endpoints. The game itself only writes through the game room, never here. */
export function registerHistoryRoutes(fastify: FastifyInstance, history: HistoryStore): void {
  fastify.get<{ Querystring: GameListQuery }>(
    '/api/games',
    { schema: { querystring: gameListQuery } },
    (request) => {
      const { player, ...rest } = request.query;
      return history.listGames(player ? { ...rest, players: player } : rest);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/api/games/:id',
    { schema: { params: idParams } },
    (request, reply) => history.getGame(request.params.id) ?? reply.code(404).send(),
  );

  fastify.delete<{ Params: { id: string } }>(
    '/api/games/:id',
    { schema: { params: idParams } },
    (request, reply) => {
      const result = history.deleteGame(request.params.id);
      const code = { deleted: 204, not_found: 404, in_progress: 409 }[result];
      return reply.code(code).send();
    },
  );

  fastify.get('/api/players', () => history.listPlayers());

  fastify.get<{ Querystring: { limit: number } }>(
    '/api/players/recent',
    { schema: { querystring: limitQuery(20, 8) } },
    (request) => history.recentPlayers(request.query.limit),
  );

  fastify.get('/api/stats/players', () => history.playerStats());

  fastify.get<{ Querystring: { limit: number } }>(
    '/api/stats/hall-of-fame',
    { schema: { querystring: limitQuery(50, 10) } },
    (request) => history.hallOfFame(request.query.limit),
  );

  fastify.get('/api/stats/games-per-month', () => history.gamesPerMonth());
}
