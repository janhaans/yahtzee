import { expect, test, type Page } from '@playwright/test';
import type { GameList } from '@yahtzee/server/api';

/** Opens the game table and makes sure no game is running, then opens player setup. */
async function openSetup(page: Page) {
  await page.goto('/');
  const stop = page.getByRole('button', { name: 'Stop spel' });
  const newGame = page.getByRole('button', { name: 'Nieuw spel' });
  await expect(stop.or(newGame)).toBeVisible();
  if (await stop.isVisible()) {
    await stop.click();
    await page.getByRole('button', { name: 'Ja, stoppen' }).click();
  }
  await newGame.click();
  await expect(page.getByRole('heading', { name: 'Wie doen er mee?' })).toBeVisible();
}

async function startGame(page: Page, names: string[]) {
  await openSetup(page);
  for (let n = 2; n < names.length; n++) {
    await page.getByRole('button', { name: '+ Speler toevoegen' }).click();
  }
  const inputs = page.getByRole('textbox');
  for (const [i, name] of names.entries()) await inputs.nth(i).fill(name);
  await page.getByRole('button', { name: /^(Aftrappen!|Start het spel)$/ }).click();
  await expect(page.getByText('Ronde 1 van 13')).toBeVisible();
}

/** The newest game in the history. */
async function latestGame(page: Page) {
  const response = await page.request.get('/api/games?pageSize=1');
  expect(response.ok()).toBe(true);
  return ((await response.json()) as GameList).items[0]!;
}

/** One turn: roll, hold the first die, roll again and take the first box that can be chosen. */
async function playTurn(page: Page, name: string) {
  await expect(page.getByRole('heading', { name: `${name} is aan de beurt!` })).toBeVisible();
  await page.getByRole('button', { name: /^Gooien!/ }).click();
  await page.getByRole('button', { name: /^Dobbelsteen 1/ }).click();
  await expect(
    page.getByRole('button', { name: /^Dobbelsteen 1: \d, vastgehouden/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Gooien!/ }).click();
  await expect(page.getByRole('button', { name: /nog 1 worp/ })).toBeVisible();

  await page.locator('.score-table button.choose:enabled').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ja!' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test('two players play a full game of 13 rounds', async ({ page }) => {
  await startGame(page, ['Emma', 'Sara']);

  for (let round = 1; round <= 13; round++) {
    await expect(page.getByText(`Ronde ${round} van 13`)).toBeVisible();
    await playTurn(page, 'Emma');
    await playTurn(page, 'Sara');
  }

  await expect(page.getByRole('heading', { name: 'Het spel is klaar!' })).toBeVisible();

  // The ranking is sorted by score and the headline names the player(s) with the best score.
  const rows = page.locator('.ranking li');
  await expect(rows).toHaveCount(2);
  const points = (await rows.locator('.points').allTextContents()).map((t) => parseInt(t, 10));
  expect(points[0]).toBeGreaterThanOrEqual(points[1]!);
  const best = await rows.locator('.name').allTextContents();
  const headline = page.locator('.winner-headline');
  if (points[0] === points[1]) {
    await expect(headline).toContainText('Gelijkspel!');
  } else {
    await expect(headline).toContainText(`${best[0]} wint!`);
  }

  // Everybody stands on the podium with a fun title.
  await expect(page.locator('.podium .title')).toHaveCount(2);

  // Every box of both players is filled in on the final scorecard.
  await expect(page.locator('.score-table tbody .filled')).toHaveCount(26);

  // The game is in the history as finished, with the same winner(s).
  const saved = await latestGame(page);
  expect(saved.status).toBe('finished');
  expect(saved.roundsPlayed).toBe(13);
  expect(saved.endedAt).not.toBeNull();
  expect(saved.players.map((p) => p.name)).toEqual(['Emma', 'Sara']);
  expect(saved.topScore).toBe(points[0]);
  const savedWinners = saved.players.filter((p) => p.isWinner).map((p) => p.name);
  expect(savedWinners).toEqual(points[0] === points[1] ? ['Emma', 'Sara'] : [best[0]]);

  await page.getByRole('button', { name: 'Nog een keer (zelfde spelers)' }).click();
  await expect(page.getByText('Ronde 1 van 13')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Emma is aan de beurt!' })).toBeVisible();
});

test('a game can be stopped early', async ({ page }) => {
  await startGame(page, ['Noor', 'Lieke', 'Fenna']);
  await playTurn(page, 'Noor');

  await page.getByRole('button', { name: 'Stop spel' }).click();
  await page.getByRole('button', { name: 'Nee, verder spelen' }).click();
  await expect(page.getByRole('heading', { name: 'Lieke is aan de beurt!' })).toBeVisible();

  await page.getByRole('button', { name: 'Stop spel' }).click();
  await page.getByRole('button', { name: 'Ja, stoppen' }).click();
  await expect(page.getByRole('button', { name: 'Nieuw spel' })).toBeVisible();

  // The game is in the history as aborted, without a winner.
  const saved = await latestGame(page);
  expect(saved.status).toBe('aborted');
  expect(saved.roundsPlayed).toBe(1);
  expect(saved.players.map((p) => p.name)).toEqual(['Noor', 'Lieke', 'Fenna']);
  expect(saved.players.some((p) => p.isWinner)).toBe(false);
});

test('setup suggests names from earlier games', async ({ page }) => {
  await openSetup(page);
  await expect(page.getByText('Eerder gespeeld:')).toBeVisible();
  await page.getByRole('button', { name: 'Noor meedoen' }).click();
  await page.getByRole('button', { name: 'Emma meedoen' }).click();
  await expect(page.getByRole('textbox').nth(0)).toHaveValue('Noor');
  await expect(page.getByRole('textbox').nth(1)).toHaveValue('Emma');
  await expect(page.getByText('Eerder gespeeld:')).toBeHidden();
});

test('setup allows 2 to 4 players with unique names', async ({ page }) => {
  await openSetup(page);
  // Two players to start with; they cannot be taken away.
  await expect(page.getByRole('textbox')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /weghalen/ })).toHaveCount(0);

  await page.getByRole('button', { name: /^(Aftrappen!|Start het spel)$/ }).click();
  await expect(page.getByRole('alert')).toHaveText('Iedere speler heeft een naam nodig.');

  const inputs = page.getByRole('textbox');
  await inputs.nth(0).fill('Anna Sophie');
  await inputs.nth(1).fill('  anna   SOPHIE ');
  await page.getByRole('button', { name: /^(Aftrappen!|Start het spel)$/ }).click();
  await expect(page.getByRole('alert')).toContainText('dezelfde naam');

  const add = page.getByRole('button', { name: '+ Speler toevoegen' });
  await add.click();
  await add.click();
  await expect(inputs).toHaveCount(4);
  await expect(add).toHaveCount(0);
});

test('the scorecard explains every box and the rules can be opened', async ({ page }) => {
  await startGame(page, ['Emma', 'Sara']);
  await page.getByRole('button', { name: 'Uitleg Kleine straat' }).click();
  await expect(page.getByRole('dialog', { name: 'Kleine straat' })).toContainText(
    'Vier getallen op een rij.',
  );
  await page.getByRole('button', { name: 'Sluiten' }).click();

  await page.getByRole('button', { name: 'Regels' }).click();
  await expect(page.getByRole('dialog', { name: 'Zo speel je Yahtzee' })).toContainText(
    '35 bonuspunten',
  );
  await page.getByRole('button', { name: 'Sluiten' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});
