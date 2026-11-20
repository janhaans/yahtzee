# Playing from phones

## Starting

1. Start the game on the laptop with `npm start`. The terminal prints the address phones
   use, e.g. `Phones join at http://192.168.1.20:3000/speler`.
2. **First time on a Mac:** macOS asks whether Node may accept incoming network connections.
   Choose **Allow**, otherwise phones cannot reach the laptop. (Changed your mind? System
   Settings → Network → Firewall → Options.)
3. Open the game on the laptop itself at http://localhost:3000 and tap **Nieuw spel**. The
   setup screen shows the QR code with the address as text under it.
4. Phones must be on the **same Wi-Fi** as the laptop. Scan the QR code with the phone's
   camera; the browser opens the player page. Enter a name, pick an avatar and a colour, tap
   **Doe mee!**. The player pops up on the laptop.
5. Laptop players can be added on the laptop as before. Tap **Aftrappen!** / **Start het
   spel** on the laptop when 2 to 4 players are in.

### Which address?

The laptop can have several addresses (Wi-Fi, a cable, a VPN, virtual machines). The QR
code uses the Wi-Fi address first. If phones cannot open it, tap **Ander adres kiezen**
under the QR code (or ☰ → **Telefoon koppelen** during a game) and pick another one; the
laptop remembers the choice. A fixed address can also be set with `PUBLIC_URL` (see
`packages/server/README.md`).

### While developing

`npm run dev` also works for phones: Vite listens on the home network and the QR code
points at port 5173.

## When a phone loses its connection

- A locked screen or a Wi-Fi hiccup: open the page again (or scan the QR code again) and
  the phone continues where it was.
- Every screen shows "Wachten op Sara..." while the phone is gone. After 15 seconds the
  laptop can play that one turn with **Speel deze beurt op de laptop**.
- A different phone or browser (or after restarting the laptop and choosing "Verder
  spelen"): scan the QR code and pick your name under **Wie ben jij?**. A laptop player can
  move to a phone this way too.

## Good to know

- Phones use plain `http://` on the home network, so a few browser features that need
  `https://` are not used: the screen may lock during long waits (it reconnects when it
  wakes up) and shake-to-roll is not possible.
- Phones buzz on their turn on Android; iPhones do not allow vibration from a web page.
- Sound on a phone starts after the first tap; until then (and on an iPhone again after the
  screen was locked or a call came in) the phone shows "Tik om geluid aan te zetten 🔊".
- On an iPhone the game also plays when the ring/silent switch is on (Safari 16.4 and
  newer); use the game's own mute button for quiet. Each phone has its own mute button.

## Checklist for real phones

Automated tests use phone-sized browser windows; check these by hand on a real Android
phone and a real iPhone before a release:

- [ ] Scanning the QR code with the camera opens the player page (Android Chrome, iPhone
      Safari).
- [ ] Join with name, avatar and colour; the player pops up on the laptop with a sound.
- [ ] Mixed game: one laptop player and one phone player play all 13 rounds; the laptop
      shows the phone's dice live and the phone shows the laptop's dice live.
- [ ] Holding dice by tapping works on the phone; the confirm dialog fits the screen.
- [ ] Lock the phone on its turn for a few seconds, unlock: it continues.
- [ ] Switch off the phone's Wi-Fi on its turn: the laptop shows "Wachten op …" and after
      15 seconds can take the turn over; with Wi-Fi back the phone plays its next turn.
- [ ] Open the page in a private tab: "Wie ben jij?" offers the offline player.
- [ ] Sounds and the Yahtzee celebration play on the phone; its mute button works.
- [ ] iPhone: lock and unlock the screen; "Tik om geluid aan te zetten" shows, one tap
      brings the sound back. With the silent switch on, the game still plays sound.
