import { expect, test, type Browser, type Page } from '@playwright/test';
import type { GameList } from '@yahtzee/server/api';
import { openSetup } from './helpers';

// The laptop and the phones are separate browser contexts, like separate devices: each has
// its own storage, so each phone keeps its own seat token. Phones use a phone-sized screen.
const PHONE = { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true };

/** A phone opens /speler and joins the game being set up on the laptop. */
async function joinWithPhone(browser: Browser, name: string) {
  const context = await browser.newContext({ ...PHONE, reducedMotion: 'reduce' });
  const phone = await context.newPage();
  await phone.goto('/speler');
  await phone.getByRole('textbox', { name: 'Hoe heet je?' }).fill(name);
  await phone.getByRole('button', { name: 'Doe mee!' }).click();
  await expect(phone.getByRole('heading', { name: `Je doet mee, ${name}!` })).toBeVisible();
  return { context, phone };
}

/** Emma plays on the laptop, Sara joins with her phone; the laptop starts the game. */
async function startMixedGame(laptop: Page, browser: Browser) {
  await openSetup(laptop);
  await laptop.getByRole('textbox').first().fill('Emma');
  const sara = await joinWithPhone(browser, 'Sara');
  // Sara pops up on the laptop in the second row.
  await expect(laptop.getByText('📱 op de telefoon')).toBeVisible();
  await laptop.getByRole('button', { name: /^(Aftrappen!|Start het spel)$/ }).click();
  await expect(laptop.getByText('Ronde 1 van 13')).toBeVisible();
  await expect(sara.phone.getByText('Ronde 1 van 13')).toBeVisible();
  return sara;
}

/** One turn on this screen: roll, hold the first die, roll again and take the first box. */
async function playTurn(page: Page, heading: string) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await page.getByRole('button', { name: /^Gooien!/ }).click();
  await page.getByRole('button', { name: /^Dobbelsteen 1/ }).click();
  await expect(
    page.getByRole('button', { name: /^Dobbelsteen 1: \d, vastgehouden/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Gooien!/ }).click();
  await expect(page.getByRole('button', { name: /nog 1 worp/ })).toBeVisible();
  await page.locator('.scorecard button.choose:enabled').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ja!' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test('the setup screen shows the QR code with the address, or says phones cannot join', async ({
  page,
}) => {
  await openSetup(page);
  const panel = page.getByRole('region', { name: 'Scan mij en doe mee!' });
  await expect(
    panel.getByText(/:\d+\/speler$/).or(panel.getByText(/Spelen op de laptop kan altijd!/)),
  ).toBeVisible();
});

test('a laptop player and a phone player play a full game together', async ({
  page: laptop,
  browser,
}) => {
  test.setTimeout(120_000);
  const { phone, context } = await startMixedGame(laptop, browser);

  for (let round = 1; round <= 13; round++) {
    // Emma's turn: the phone waits and watches.
    await expect(phone.getByRole('heading', { name: 'Emma is aan de beurt' })).toBeVisible();
    await expect(phone.getByText('Even wachten... kijk maar mee!')).toBeVisible();
    await expect(phone.getByRole('button', { name: /^Gooien!/ })).toBeHidden();
    await playTurn(laptop, 'Emma is aan de beurt');

    // Sara's turn: the laptop only watches.
    await expect(laptop.getByText('Sara speelt op de telefoon 📱')).toBeVisible();
    await expect(laptop.getByRole('button', { name: /^Gooien!/ })).toBeHidden();
    await playTurn(phone, 'Jouw beurt, Sara!');
  }

  await expect(laptop.getByText('Eindstand')).toBeVisible();
  await expect(phone.getByText('Eindstand')).toBeVisible();
  await expect(phone.getByText('Nog een keer spelen? Dat start je op de laptop.')).toBeVisible();

  const response = await laptop.request.get('/api/games?pageSize=1');
  const game = ((await response.json()) as GameList).items[0]!;
  expect(game.status).toBe('finished');
  expect(game.players.map((p) => p.name)).toEqual(['Emma', 'Sara']);

  // "Nog een keer": the phone plays on in the new game.
  await laptop.getByRole('button', { name: 'Nog een keer' }).click();
  await expect(phone.getByRole('heading', { name: 'Emma is aan de beurt' })).toBeVisible();
  await context.close();
});

test('a phone that loses its connection comes back, or the laptop plays its turn', async ({
  page: laptop,
  browser,
}) => {
  test.setTimeout(90_000);
  const { context } = await startMixedGame(laptop, browser);
  await playTurn(laptop, 'Emma is aan de beurt');

  // The screen locks on Sara's turn: the page goes away, then comes back.
  let phone = context.pages()[0]!;
  await phone.close();
  await expect(laptop.getByText(/^Wachten op Sara\.\.\./)).toBeVisible();
  phone = await context.newPage();
  await phone.goto('/speler');
  await playTurn(phone, 'Jouw beurt, Sara!');

  // Next round the phone is gone for good: after a while the laptop plays that one turn.
  await playTurn(laptop, 'Emma is aan de beurt');
  await phone.close();
  const takeOver = laptop.getByRole('button', { name: 'Speel deze beurt op de laptop' });
  await expect(takeOver).toBeVisible({ timeout: 25_000 });
  await takeOver.click();
  await playTurn(laptop, 'Sara is aan de beurt');
  await expect(laptop.getByText('Ronde 3 van 13')).toBeVisible();

  // The take-over was for one turn only: Sara's next turn waits for her phone again.
  await playTurn(laptop, 'Emma is aan de beurt');
  await expect(laptop.getByText(/^Wachten op Sara\.\.\./)).toBeVisible();
  await expect(laptop.getByRole('button', { name: /^Gooien!/ })).toBeHidden();
  await expect(takeOver).toBeVisible();
  await context.close();
});

test('"Wie ben jij?" lets a new phone take over a player', async ({ page: laptop, browser }) => {
  const sara = await startMixedGame(laptop, browser);

  // A phone that never joined sees who is playing where, and picks Emma from the laptop.
  const context = await browser.newContext({ ...PHONE, reducedMotion: 'reduce' });
  const emma = await context.newPage();
  await emma.goto('/speler');
  await expect(emma.getByRole('heading', { name: 'Wie ben jij?' })).toBeVisible();
  await expect(emma.getByRole('button', { name: /Sara.*speelt al/ })).toBeDisabled();
  await emma.getByRole('button', { name: /Emma.*nu op de laptop/ }).click();

  await playTurn(emma, 'Jouw beurt, Emma!');
  await expect(laptop.getByText('Sara speelt op de telefoon 📱')).toBeVisible();
  await playTurn(sara.phone, 'Jouw beurt, Sara!');
  // Emma's turns are on her phone now, not on the laptop.
  await expect(laptop.getByText('Emma speelt op de telefoon 📱')).toBeVisible();
  await context.close();
  await sara.context.close();
});
