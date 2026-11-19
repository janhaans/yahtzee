# @yahtzee/web

React + Vite app. For now it holds the game table on the laptop (`/`); the player view
(`/speler`) and the History Dashboard (`/dashboard`) follow in milestones 5 and 6.

- All Dutch text lives in `src/i18n/nl.ts`.
- `src/useGame.ts` connects to the server; the UI only sends intentions.
- Colours and fonts are CSS variables in `src/styles.css`, ready for themes in milestone 4.

In development `npm run dev` (from the repository root) starts Vite on
http://localhost:5173 and forwards the socket to the server on port 3000.
