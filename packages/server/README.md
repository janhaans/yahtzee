# @yahtzee/server

Fastify + Socket.IO server that owns the game state and rolls the dice. Clients only send
intentions (`game:create`, `game:roll`, `game:toggleHold`, `game:chooseBox`, `game:abort`,
`game:rematch`; see `src/protocol.ts`). The server checks every intention against the game
rules, including the Joker rule, and broadcasts the new state to every screen.

- `src/room.ts` – the one game on this laptop (in memory until milestone 3 adds SQLite)
- `src/app.ts` – Fastify, Socket.IO and, in production, the built web app
- `src/config.ts` – settings from environment variables

## Environment variables

| Variable       | Default                                  | Meaning                                                            |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `PORT`         | `3000`                                   | Port to listen on                                                  |
| `HOST`         | `0.0.0.0` (production), else `127.0.0.1` | Address to listen on                                               |
| `SERVE_WEB`    | on in production                         | `1` serves `packages/web/dist`                                     |
| `YAHTZEE_SEED` | –                                        | Predictable dice; ignored when `NODE_ENV=production` (`npm start`) |
