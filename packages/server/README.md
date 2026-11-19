# @yahtzee/server

Fastify + Socket.IO server that owns the game state and rolls the dice. Clients only send
intentions (`game:create`, `game:roll`, `game:toggleHold`, `game:chooseBox`, `game:abort`,
`game:rematch`, `game:resume`, `game:discardUnfinished`; see `src/protocol.ts`). The server
checks every intention against the game rules, including the Joker rule, and broadcasts the
new state to every screen.

- `src/room.ts` – the one game on this laptop; saves it to the history after every change
- `src/app.ts` – Fastify, Socket.IO and, in production, the built web app
- `src/config.ts` – settings from environment variables
- `src/history/` – the game history in SQLite (Node's built-in `node:sqlite`)
  - `db.ts` – opens the database and runs schema migrations (`PRAGMA user_version`)
  - `store.ts` – saving games and the queries for the dashboard
  - `routes.ts` – the REST API; `api.ts` – its response types, shared with the web app

## Game history

- A game goes into the history at its first roll. After every roll, hold and box choice the
  whole game is saved again (one transaction), including a snapshot to continue after a crash.
- If a save fails, the game goes on, every screen gets `history:saveFailed`, and the save is
  tried again after the next turn.
- On start-up, an unfinished game is offered to continue or stop (`game:unfinished`). Stopping
  saves it as aborted, ending at its last save. Older unfinished games are marked aborted.
- Players are matched by name, ignoring case and extra spaces: the same name is the same player.
- Node prints an `ExperimentalWarning` for `node:sqlite` on start; that is expected.

| Endpoint                         | Purpose                                                   |
| -------------------------------- | --------------------------------------------------------- |
| `GET /api/games`                 | Game list, newest first; filters, sorting, pages (below)  |
| `GET /api/games/:id`             | One game with every scorecard                             |
| `DELETE /api/games/:id`          | Delete a finished or aborted game (409 while in progress) |
| `GET /api/players`               | Everyone who played, by name                              |
| `GET /api/players/recent?limit=` | Most recent players first (default 8), for quick setup    |
| `GET /api/stats/players`         | Games, wins, win %, best and average score, Yahtzees      |
| `GET /api/stats/hall-of-fame`    | Top scores of finished games (default 10)                 |
| `GET /api/stats/games-per-month` | Games per month (Europe/Amsterdam)                        |

`/api/games` query: `from`, `to` (`yyyy-mm-dd`, days in Amsterdam), `player` (repeat for
several: games where all of them played), `winner`, `status`, `playerCount`, `minScore` and
`maxScore` (on the highest score of the game), `sort` (`date`, `duration`, `players`, `score`,
`winner`, `status`), `order` (`asc`/`desc`), `page`, `pageSize` (default 25, max 100).

## Environment variables

| Variable       | Default                                  | Meaning                                                            |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `PORT`         | `3000`                                   | Port to listen on                                                  |
| `HOST`         | `0.0.0.0` (production), else `127.0.0.1` | Address to listen on                                               |
| `SERVE_WEB`    | on in production                         | `1` serves `packages/web/dist`                                     |
| `YAHTZEE_SEED` | –                                        | Predictable dice; ignored when `NODE_ENV=production` (`npm start`) |
| `YAHTZEE_DB`   | `data/yahtzee.db`                        | SQLite file with the game history                                  |
