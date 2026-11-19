import { expect, test, type Page } from '@playwright/test';

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
  await page.getByRole('button', { name: String(names.length), exact: true }).click();
  const inputs = page.getByRole('textbox');
  for (const [i, name] of names.entries()) await inputs.nth(i).fill(name);
  await page.getByRole('button', { name: 'Start!' }).click();
  await expect(page.getByText('Ronde 1 van 13')).toBeVisible();
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

  // Every box of both players is filled in on the final scorecard.
  await expect(page.locator('.score-table tbody .filled')).toHaveCount(26);

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
});

test('setup allows 2 to 4 players with unique names', async ({ page }) => {
  await openSetup(page);
  await expect(page.getByRole('button', { name: '1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '5', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Start!' }).click();
  await expect(page.getByRole('alert')).toHaveText('Iedere speler heeft een naam nodig.');

  const inputs = page.getByRole('textbox');
  await inputs.nth(0).fill('Anna Sophie');
  await inputs.nth(1).fill('  anna   SOPHIE ');
  await page.getByRole('button', { name: 'Start!' }).click();
  await expect(page.getByRole('alert')).toContainText('dezelfde naam');

  await page.getByRole('button', { name: '4', exact: true }).click();
  await expect(inputs).toHaveCount(4);
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
