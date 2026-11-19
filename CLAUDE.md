# Yahtzee Party – instructions for Claude Code

## What this project is

A Dutch, kid-friendly Yahtzee game ("Yahtzee Party") for a 12-year-old girl, played by
2 to 4 players. It runs on one laptop at home; players play on the laptop itself or join
from their own phone (Android / iPhone) over the home Wi-Fi by scanning a QR code.
Every game is stored in a history, and a separate History Dashboard lets anyone query it.

The full requirements are in `docs/PRD.md`. Read it before starting a milestone and
follow it. If something in the PRD is unclear or conflicts, ask before guessing.

## Tech stack (from PRD section 9)

- TypeScript everywhere, Node.js LTS
- Front-end: React + Vite, responsive (phone, tablet, laptop)
  - `/` = game table on the laptop
  - `/speler` = player view on a phone
  - `/dashboard` = History Dashboard
- Back-end: Node.js server (Fastify) on the laptop, real-time via Socket.IO,
  REST endpoints for the history
- Database: SQLite (one file in `data/`)
- Tests: Vitest (unit), Playwright (end-to-end)

## Project structure

- `packages/game-logic` – pure TypeScript scoring and game rules, no UI, no I/O
- `packages/server` – Fastify + Socket.IO + SQLite
- `packages/web` – React app (game table, player view, dashboard)
- `docs/` – PRD and other documents

## Rules for working on this project

- Work milestone by milestone (PRD section 10). Don't start the next milestone unasked.
- Make a plan first and show it to me before writing a lot of code.
- The server owns the game state and rolls the dice. Clients only send intentions
  (roll, hold die, choose box).
- Game logic must be 100% covered by unit tests, including bonus, Yahtzee bonus,
  Joker rule and ties. Run the tests after every change and fix failures.
- All user-facing text is Dutch and lives in one translation file
  (`packages/web/src/i18n/nl.ts`). Code, comments and commit messages are English.
- Every player has a `type` field (`human` | `computer`) so a computer player
  can be added in version 2.
- Store times in UTC; show them in Europe/Amsterdam as `dd-mm-yyyy HH:mm`.
- Messages to players are always positive and never mean.
- No external services, tracking, ads or internet access needed while playing.
- Keep it simple: this is a family game, not an enterprise app.

## Commands

- `npm install` – install dependencies
- `npm run dev` – start server and web app for development
- `npm start` – start for playing (listens on the home network)
- `npm test` – run all unit tests
- `npm run test:e2e` – run Playwright tests
