# @yahtzee/web

React + Vite app with the game table on the laptop (`/`) and the player view on a phone
(`/speler`). The History Dashboard (`/dashboard`) follows in milestone 6.

- All Dutch text lives in `src/i18n/nl.ts`, including the funny messages and titles.
- `src/useGame.ts` connects to the server; the UI only sends intentions.
- `src/settings.ts` keeps this device's theme, mute setting, chosen QR address and, on a
  phone, its seat token and last name and looks in localStorage.

## Playing from a phone (milestone 5)

- **Laptop**: the setup screen shows the server's lobby and a QR code
  (`src/components/JoinPanel.tsx`, drawn locally by `QrCode.tsx` with the `qrcode` package)
  with the address as text under it. "Ander adres kiezen" (also in the ☰ menu as "Telefoon
  koppelen") picks another address when the laptop has several.
- **Phone** (`src/phone/`): `PlayerApp.tsx` picks the screen: join form, waiting room, the
  game, the end screen, or "Wie ben jij?" when a game runs without this phone.
- **Game screen**: `GameScreen` takes the seats and, on a phone, `me`. It only offers the
  roll button and point previews to whoever may play the turn; a waiting phone shows its own
  scorecard. "Wachten op …" and the laptop's "Speel deze beurt op de laptop" come from the
  seat's `offlineSince`.

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
