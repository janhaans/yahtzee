# Yahtzee Party – Product Requirements Document

Version 1.1 · Nov 18, 2026 · @Jan Haans

## 1. Overview and goals

**Yahtzee Party** is a colourful, playful **Dutch** version of the classic dice game Yahtzee, built for a 12-year-old girl to play with family and friends. The game runs on one laptop at home. Two to four players take turns rolling five dice, keeping the ones they like, and filling in a scorecard, either on the laptop itself or on their own phone (Android or iPhone). Every game is saved automatically, and a separate **History Dashboard** lets anyone look back at past games: who played, the scores, who won, and whether the game was finished or stopped early.

**Goals**

- **Fun first:** the game should feel like a party, with bright themes, animations, sounds and silly messages, so she *wants* to play it again.
- **Easy to learn:** a 12-year-old can start a game without help from an adult, and the game explains each scoring box while she plays.
- **Correct rules:** scoring follows the official Yahtzee rules, calculated automatically so nobody has to do maths or argue.
- **Memories:** every game is stored with date, time, players, scores, winner and status, and can be explored in the dashboard.

**Success criteria**

- She can set up and finish a 2-player game on her own in under 2 minutes of setup.
- Zero scoring mistakes compared with the official rules (verified by automated tests).
- 100% of started games appear in the history, with the correct status (finished or aborted).
- She asks to play it again (the real test).

## 2. Target users

| User | Description | What they need |
| --- | --- | --- |
| **Main player** (12-year-old girl) | Plays with friends, siblings or parents. Likes bright colours, cute or funny themes, emojis and surprises. Short attention span for menus and long texts. | Big buttons, quick setup, fun reactions, the feeling of being rewarded, simple explanations. |
| **Other players** (friends, family, age 8 to adult) | Join a game on the same device. May not know the rules. | Clear indication of whose turn it is, rule hints, fair automatic scoring. |
| **Parent / owner** (you) | Builds and maintains the game with Claude Code. Looks at game history. | Clean, testable code, simple local setup, easy to extend, data that is safe and private. |

**Devices:** the game runs on one laptop at home, which is also the shared "game table" screen everyone can watch. Players can play on the laptop itself, or join with their own phone (Android or iPhone) in the normal browser over the home Wi-Fi. Everything must work well on touchscreens and with a mouse.

## 3. Scope

**In scope (version 1)**

- Yahtzee for 2, 3 or 4 human players, hosted on one laptop. Each player plays either on the laptop (pass-and-play) or on their own phone (Android or iPhone) over the home Wi-Fi; both can be mixed in one game.
- All texts in **Dutch**: buttons, rules, funny messages, the dashboard and the scoring boxes (Enen, Tweeën, Drieën, Vieren, Vijven, Zessen, Drie gelijke, Vier gelijke, Full House, Kleine straat, Grote straat, Yahtzee, Kans).
- Full standard Yahtzee rules, including the upper-section bonus and Yahtzee bonuses.
- Player setup with name, avatar and colour.
- Fun layer: themes, dice skins, animations, sounds, funny messages, celebrations.
- Automatic saving of every game to a local database, including aborted games.
- Separate History Dashboard (its own page/app) to search, filter and view past games and simple statistics.

**Out of scope (version 1)**

- Playing over the internet, outside the home network (phones must be on the same Wi-Fi as the laptop).
- Computer opponent: not in version 1, but planned for version 2 (see section 10). Version 1 is built so it can be added easily.
- User accounts, passwords or logins.
- In-app purchases, ads or any connection to social media.
- App store versions (iOS/Android apps). Phones use their normal browser (Safari or Chrome); no app installation needed.

## 4. Game rules

The game follows the official Yahtzee rules.

**Turn structure**

- A game has **13 rounds**. In each round every player gets one turn, in a fixed order.
- On a turn the player rolls 5 dice up to **3 times**. After each roll she can tap dice to *hold* them (held dice are not re-rolled). Held dice can be released again before the next roll.
- After the last roll (or earlier, if she is happy) she **must** choose one empty box on her scorecard. If no box gives points, she must enter a 0 in a box of her choice (a "scratch").
- Each box can be filled only once. The game ends when all players have filled all 13 boxes.

**Scorecard**

| Section | Box | Score |
| --- | --- | --- |
| Upper | Ones, Twos, Threes, Fours, Fives, Sixes | Sum of the dice showing that number |
| Upper | **Bonus** | +35 if the upper total is 63 or more |
| Lower | Three of a Kind | Sum of all dice, if at least 3 are the same |
| Lower | Four of a Kind | Sum of all dice, if at least 4 are the same |
| Lower | Full House | 25 (three of one number + two of another) |
| Lower | Small Straight | 30 (4 numbers in a row) |
| Lower | Large Straight | 40 (5 numbers in a row) |
| Lower | Yahtzee | 50 (all 5 dice the same) |
| Lower | Chance | Sum of all dice, any combination |
| Lower | **Yahtzee Bonus** | +100 for each extra Yahtzee, if the Yahtzee box already holds 50 |

**Extra Yahtzee (Joker rule)**

- If a player rolls another Yahtzee and her Yahtzee box holds 50, she gets +100 bonus.
- She must then fill the matching upper box if it is empty. If it is already filled, she may use the Yahtzee as a "Joker" in any empty lower box: Full House, Small Straight and Large Straight then score their full value.
- If the Yahtzee box holds 0 (scratched), there is no bonus, but the Joker rule still applies.

**Winning**

- The player with the highest grand total (upper + bonus + lower + Yahtzee bonuses) wins.
- If two or more players have the same highest score, it is a **tie** and all of them are winners.

**Scoring help**

- The game shows a *preview* of the points each empty box would give for the current dice, so players never have to calculate.
- Each box has a small (i) button with a one-line explanation and an example in kid-friendly words.

## 5. Fun features

These are what turn a plain dice game into something a 12-year-old wants to play. Priority: **Must** = version 1, **Should** = version 1 if time allows, **Could** = later.

| Feature | Description | Priority |
| --- | --- | --- |
| **Themes** | Choose a look for the whole game. Two themes, based on what your daughter loves, in a modern, minimal style: a calm light background, white cards and one accent colour per theme. *Voetbalstadion* (soccer): grass green accent, a light-green dice table with white chalk lines, a cheering crowd. *Snoepwinkel* (sweets): candy pink accent, a light-pink dice table with a few sprinkles, happy jingles. The theme changes the accent colour, subtle details, sounds and celebrations. | Must (both themes) |
| **Avatars and colours** | Each player picks a fun avatar and a colour. Soccer avatars (football, goalkeeper glove, trophy, a player in a team shirt) and sweet avatars (cupcake, lollipop, donut, ice cream, gummy bear), plus a few animals. Shown on the scorecard and on the "whose turn" banner. | Must |
| **3D rolling dice** | Dice roll in 3D with the sound of rolling dice. **Laptop:** real 3D with physics (e.g. three.js with a physics engine): the dice are thrown onto the table, bounce off each other and the edges, and roll out. **Phones:** lighter CSS 3D cubes that spin and land on the right number, so it runs smoothly on every phone, including older ones. The server always decides the numbers; the animation only shows how the dice land on them. Held dice stay in place, wiggle and get a glowing border. The dice are plain white with dark or accent-coloured pips; the sounds match the theme. Sound on iPhones starts after the first tap on the screen. Tapping skips the animation. | Must |
| **Yahtzee celebration** | Five-of-a-kind triggers a giant "YAHTZEE!!!" banner with a theme celebration: in *Voetbalstadion* a ball flies into the net, the crowd roars "GOOOAL!" and fireworks go off; in *Snoepwinkel* it rains sweets and confetti sprinkles with a happy jingle. | Must |
| **Funny messages** | Short random reactions in Dutch after events, matching the theme. Soccer: "Wat een knaller!", "Grote straat... recht op het doel af!", "Oei, nul punten. Dat was buitenspel!". Sweets: "Full House! Zoet als een snoepje!", "Mmm, wat een lekkere worp!", "Nul punten... die dobbelstenen hebben te veel suiker op." At least 30 messages per theme, never mean. | Must |
| **Sound on/off** | Fun sound effects with a big mute button (for quiet moments). | Must |
| **Turn banner** | Big animated banner: "Emma's turn!" with her avatar, so it's clear who rolls next. | Must |
| **Winner party** | End screen with podium (1st, 2nd, 3rd), trophies, confetti and a dancing avatar for the winner. Every player gets a fun theme title, e.g. "Topscorer", "Man/Vrouw van de wedstrijd", "Snoepkoningin", "Suikerspin-kampioen". | Must |
| **Dice skins** | Extra dice designs to choose from (the default dice are plain white), e.g. football dice, sugar-cube or gummy-sweet dice, club colours (your daughter's favourite club), Oranje dice, chocolate dice, candy-stripe dice, glitter. | Should |
| **Badges** | Small achievements saved per player name, e.g. "First Yahtzee", "Bonus Hunter" (got the 35 bonus), "300 Club". | Could |
| **Shake to roll** | On a tablet, shake the device to roll the dice. | Could |

**Tone and safety rules**

- Messages are positive, silly and encouraging. Losing players are never made fun of.
- No ads, no chat, no internet connection needed, no personal data except first names.
- Animations can be skipped by tapping, so games don't get slow.

## 6. Game flow and screens

1. **Start screen:** game logo, big "New Game" button, "History" button (opens the dashboard), settings (theme, sound).
2. **Player setup:** choose number of players (2, 3 or 4). For each player: enter a name (required, max 15 characters, names unique within a game), pick an avatar and a colour. Recently used names are suggested for quick setup. Player order can be shuffled with a "Who starts?" dice-roll animation.
3. **Game screen:**
   - Five large dice in the middle; tap a die to hold or release it.
   - "Roll" button with the number of rolls left (3, 2, 1).
   - Scorecard of the current player, with point previews for the empty boxes.
   - Small score overview of all players (name, avatar, current total) and the round number (e.g. "Round 5 of 13").
   - Menu button with "Rules", "Sound on/off" and "Stop game".
4. **Confirm box choice:** after tapping a box, a short confirmation ("Put 25 in Full House?") prevents mistakes. Scratching (entering 0) always asks for confirmation.
5. **Next player:** turn banner animation, then the next player rolls.
6. **End screen:** winner party, final scorecard of all players, buttons "Play again (same players)", "New game" and "View history".

**Stopping a game early (abort)**

- "Stop game" asks: "Are you sure? The game will be saved as *aborted*."
- When confirmed, the game is stored with status **Aborted**, the current scores and the round reached. No winner is recorded.
- If the browser is closed or the device crashes during a game, the game is saved automatically after every turn. On the next start the app asks: "You have an unfinished game. Continue or stop it?" Choosing "stop" marks it as Aborted.

**Undo**

- The player can undo the last box choice until the next player has rolled (Should).

**Playing from a phone**

- On the player setup screen the laptop shows a big QR code: "Scan mij en doe mee!".
- A player scans it with her phone camera, enters her name and picks an avatar and colour on her phone. She pops up on the laptop screen with a happy animation.
- On the laptop, players who play on the laptop itself can also be added. The game can start as soon as 2 to 4 players have joined; one person taps "Start" on the laptop.
- On her turn, her phone shows the dice, the "Gooien!" button and her scorecard with point previews. She taps dice to hold them and chooses her box on the phone. Shaking the phone to roll is a Could.
- When it is not her turn, her phone shows the other player's dice live, the scores, and a fun "Even wachten..." screen.
- The laptop always shows the game table: all players, scores, the current dice and the big celebrations, so everyone can watch together.
- A phone only controls its own player: nobody can roll or choose a box for someone else. Dice are rolled on the laptop's server, so nobody can cheat.

## 7. Game history

**What must be recorded for every game**

| Field | Description |
| --- | --- |
| Game ID | Unique identifier |
| Start date and time | When the first roll was made |
| End date and time | When the game was finished or aborted |
| Duration | Calculated from start and end |
| Participants | Names (plus avatar and colour) of all 2 to 4 players, in playing order |
| Score per player | Final total, plus upper total, bonus, lower total and Yahtzee bonus count |
| Scorecard per player | The value in each of the 13 boxes (empty if not filled, in aborted games) |
| Winner(s) | Name(s) of the player(s) with the highest score; empty for aborted games; several names for a tie |
| Status | **Finished** (all 13 rounds played) or **Aborted** (stopped early or never resumed); *In progress* only while the game is being played |
| Rounds played | 1 to 13, useful for aborted games |
| Theme | Which theme was used (fun to look back on) |

**Rules**

- A game is created in the history at the first roll. Setting up players without rolling does not create a history entry.
- The game state is saved after every turn, so nothing is lost on a crash.
- History entries cannot be edited from the game. Deleting is only possible in the dashboard, with a confirmation (Should).
- Times are stored in UTC and shown in local time (Europe/Amsterdam), format `dd-mm-yyyy HH:mm`.

**Data model (proposal)**

- `players`: id, name (unique), avatar, colour, created\_at. A player who plays again with the same name is the same player, so the dashboard can show statistics per person.
- `games`: id, started\_at, ended\_at, status (in\_progress / finished / aborted), rounds\_played, theme.
- `game_players`: game\_id, player\_id, seat\_order, upper\_total, upper\_bonus, lower\_total, yahtzee\_bonus\_count, final\_score, is\_winner, scorecard (13 box values).
- `turns` (Should): game\_id, player\_id, round, dice per roll, box chosen, points. Enables fun statistics such as "number of Yahtzees ever rolled".

## 8. History Dashboard

The dashboard is a **separate page/app** (its own URL, e.g. `/dashboard`) that reads the same game history. It uses the same playful style as the game, but is focused on looking things up.

**Game list (main view)**

- Table of all games, newest first, with columns: date, start time, duration, players (with avatars), scores, winner (with trophy icon), status (Finished = green badge, Aborted = grey badge).
- Pagination or "load more" at 25 games per page.
- Sort by any column.

**Search and filters**

- Date range (from and to), with quick picks: today, this week, this month, this year.
- Player: show games in which one or more selected players took part.
- Winner: show games won by a selected player.
- Status: all, finished, aborted.
- Number of players: 2, 3 or 4.
- Minimum or maximum score.
- Filters can be combined, and a "Clear filters" button resets them.

**Game detail**

- Clicking a game opens the full scorecard of every player, side by side, with winner highlighted, start and end time, duration, rounds played and theme.

**Statistics (Should)**

- Per player: games played, games won, win percentage, highest score, average score, number of Yahtzees.
- Leaderboard: top 10 highest scores ever ("Hall of Fame").
- Simple charts: games played per month, wins per player.

**Export (Could)**

- Export the filtered list to CSV.

## 9. Non-functional requirements and technical approach

**Non-functional requirements**

- **Usability:** buttons at least 48 x 48 px; readable text (min 16 px); works on phones (from iPhone SE size, portrait), tablets and laptops.
- **Performance:** a roll animation takes no more than 1 second; the dashboard loads 1,000 games in under 2 seconds.
- **Reliability:** game state saved after every turn; no data loss on refresh or crash.
- **Privacy:** all data stays on the laptop; phones only connect to the laptop over the home Wi-Fi; only first names are stored; no tracking, no ads, no internet needed while playing.
- **Accessibility:** dice also show dots or numbers clearly in every theme; colours are never the only way to see information; all sounds can be muted.
- **Language:** all texts in Dutch (Nederlands). Texts are kept in one translation file, so English could be added later (Could).
- **Dashboard access:** open for everyone on the home network; no login or PIN.
- **Connection loss:** if a phone loses its connection (screen lock, Wi-Fi hiccup), the player reconnects automatically or by scanning the QR code again and continues where she was. The game waits with a funny "Wachten op Emma..." message, and the laptop can take over that player's turn if needed.

**Technical approach (proposal, to be confirmed in the design phase)**

- **Development:** built with Claude Code in a local development environment, using Git for version control.
- **Front-end (game and dashboard):** web app with TypeScript and React, built with Vite, responsive for phone, tablet and laptop. Three views: the game table on the laptop (`/`), the player view on a phone (`/speler`) and the dashboard (`/dashboard`).
- **Back-end:** small Node.js server (e.g. Fastify) running on the laptop. It owns the game state, rolls the dice (so no device can cheat) and sends every roll and score to all connected screens in real time via WebSockets (e.g. Socket.IO). REST endpoints serve the history: create a game, save a turn, finish or abort a game, and query history with filters.
- **Database:** SQLite, one file on disk; easy to back up and needs no server.
- **Game logic:** the scoring rules live in a separate, pure TypeScript module with no UI code, so they can be fully unit-tested.
- **Ready for a computer opponent:** from version 1 each player has a type (*human* or *computer*) in the data model, and the game asks every player for their moves through one common interface. A computer player can then be plugged in later without changing the game rules or the history.
- **Testing:** unit tests (Vitest) for every scoring box, bonuses and Joker rule; end-to-end tests (Playwright) for a full 2-player game, an aborted game and the dashboard filters.
- **Running:** one command (`npm run dev` while developing, `npm start` for playing) starts game, dashboard and server on the laptop. The server listens on the home network, and the laptop shows a QR code with its address (e.g. `http://192.168.1.20:3000/speler`) that players scan with their phone camera to join.

## 10. Milestones, acceptance criteria and open questions

**Milestones**

| # | Milestone | Result |
| --- | --- | --- |
| 1 | Project setup and game logic | Repository, tooling, scoring module with full unit tests |
| 2 | Playable game (basic look) | 2 to 4 players can play a full game with correct scoring |
| 3 | History storage | API and SQLite database; finished and aborted games saved |
| 4 | Fun layer | Themes, avatars, 3D rolling dice with sound (physics on the laptop, CSS 3D on phones), animations, sounds, messages, Yahtzee and winner celebrations |
| 5 | Play from phones | Players join by QR code and play on their own Android phone or iPhone; live updates on the laptop; reconnect after connection loss |
| 6 | History Dashboard | Game list, filters, game detail; statistics if time allows |
| 7 | Play-testing with your daughter | Feedback round, fixes and polish |
| 8 | Version 2: computer opponent | See roadmap below |

**Acceptance criteria (version 1)**

- [ ] A game can be started with 2, 3 and 4 players; 1 or 5 players is not possible.
- [ ] All 13 boxes, the 35-point bonus, Yahtzee bonus and Joker rule score exactly as described in section 4.
- [ ] The current player and the round number are always clearly visible.
- [ ] Every finished game is saved with date, time, players, scores, winner(s) and status *Finished*.
- [ ] Every stopped or abandoned game is saved with status *Aborted* and no winner.
- [ ] The dashboard shows all games and can filter by date, player, winner and status.
- [ ] At least 2 themes, the Yahtzee celebration and the winner party work.
- [ ] Your daughter can start and play a game without help.
- [ ] All screens, rules, messages and the dashboard are in Dutch.
- [ ] A player can join with an Android phone and with an iPhone by scanning the QR code, and play all her turns on her phone while the laptop shows the game live.
- [ ] Laptop players and phone players can be mixed in one game.
- [ ] A phone that loses its connection can rejoin and continue the game.

**Open questions**

- None at the moment: all questions have been answered (see Decisions).

**Decisions (18-11-2026)**

- **Language:** the game and the dashboard are in Dutch.
- **Devices:** the game runs on one laptop; players can also play from their own phone (Android or iPhone) over the home Wi-Fi.
- **Dashboard:** open for everyone, no PIN or login.
- **Computer opponent:** yes, in a later version (version 2).
- **Sounds and celebrations:** play on the laptop *and* on the phones (confetti, fanfare, funny messages). Each phone has its own mute button.
- **Computer opponent style:** one computer player per game, without difficulty levels.
- **Themes:** soccer (*Voetbalstadion*) and sweets (*Snoepwinkel*), both in version 1.
- **Computer player name:** "Computer".
- **3D dice (19-11-2026):** dice roll in 3D with rolling sound, built in milestone 4: real 3D with physics on the laptop, CSS 3D cubes on phones.
- **Look and feel (20-11-2026):** modern and minimal, following the design mockups: light background, white cards, Nunito font, one accent per theme (Voetbalstadion #187A41, Snoepwinkel #C2255C); the theme shows only in subtle details.
- **Dice (20-11-2026):** plain white dice in both themes. Themed dice (footballs, sugar cubes, gummy sweets) may return later as optional dice skins.

**Roadmap: version 2 – computer opponent**

- One computer player can be added to a game, so she can also play alone (1 human + the computer) or play with friends plus the computer (maximum 4 players in total).
- No difficulty levels: the computer has one playing style. It makes sensible choices (it picks the box that gives the most points now and keeps dice for obvious combinations) but does not plan ahead like an expert, so a 12-year-old can regularly beat it.
- The computer player is called **Computer**. It has its own robot avatar and short funny comments ("Biep boep, ik ga voor de Yahtzee!"). Its turns are shown with a short animation so humans can follow.
- Computer players are stored in the history like any player, marked as *computer*; the dashboard can filter on games with or without computer players and shows statistics separately.
