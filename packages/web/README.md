# @yahtzee/web

React + Vite app. For now it holds the game table on the laptop (`/`); the player view
(`/speler`) and the History Dashboard (`/dashboard`) follow in milestones 5 and 6.

- All Dutch text lives in `src/i18n/nl.ts`, including the funny messages and titles.
- `src/useGame.ts` connects to the server; the UI only sends intentions.
- `src/settings.ts` keeps this device's theme and mute setting in localStorage.

## Look

The design follows the mockups in `docs/design/`: a light page, white cards with soft shadows,
the Nunito font (bundled through `@fontsource-variable/nunito`, so it works offline) and one
accent colour per theme. Styles live in `src/styles/`, one file per screen plus `base.css`
(colours, buttons, cards, dialogs), `themes.css` (accent and the subtle chalk lines or
sprinkles), `dice.css` and `fun.css` (messages, banners, celebrations). Each screen has a
phone layout below 600 px.

## Fun layer (milestone 4)

- **Themes**: `src/styles/themes.css` (accent and table details per `[data-theme]`) and
  `src/themes/index.ts` (dice looks as data: the themes use plain white dice; the football
  and sugar looks are kept as dice skins for later).
- **Events**: `src/fun/events.ts` compares two game states and says what happened (roll,
  hold, scored box, next turn, game over). Messages, sounds, banners and celebrations all
  react to these events, so phones can reuse them.
- **Dice**: `src/components/Dice.tsx` draws CSS 3D cubes (phones, and the fallback).
  On the laptop `src/dice3d/` throws real 3D dice with three.js and cannon-es; it is a
  separate lazy chunk. The physics runs first, then the dice are labelled so the face on
  top shows the value the server rolled (`src/dice3d/faces.ts`).
- **Sound**: `src/sound/` makes every sound with Web Audio. The soccer crowd and
  "GOOOAL!" can be real recordings in `public/sounds/` (see the README there).
- **Celebrations**: `src/celebrate/` (Yahtzee party, confetti) and the podium in
  `src/components/EndScreen.tsx`.

Animations are skipped when the device asks for reduced motion; the e2e tests run that way,
except the tests that check the animations themselves.

In development `npm run dev` (from the repository root) starts Vite on
http://localhost:5173 and forwards the socket to the server on port 3000.
