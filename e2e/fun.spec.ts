import { expect, test, type Page } from '@playwright/test';
import { openStart } from './helpers';

async function startGame(page: Page, theme: string, names: string[]) {
  await openStart(page);
  await page.getByRole('button', { name: theme }).click();
  await page.getByRole('button', { name: 'Nieuw spel' }).click();
  const inputs = page.getByRole('textbox');
  for (const [i, name] of names.entries()) await inputs.nth(i).fill(name);
  await page.getByRole('button', { name: /^(Aftrappen!|Start het spel)$/ }).click();
  await expect(page.getByText('Ronde 1 van 13')).toBeVisible();
}

test('the chosen theme, avatars and colours are used and saved', async ({ page }) => {
  await openStart(page);
  await page.getByRole('button', { name: 'Snoepwinkel' }).click();
  await page.getByRole('button', { name: 'Nieuw spel' }).click();
  await page.getByRole('textbox').nth(0).fill('Emma');
  await page.getByRole('textbox').nth(1).fill('Sara');
  await page.getByRole('button', { name: /Kies een plaatje voor speler 2/ }).click();
  await page.getByRole('button', { name: 'Eenhoorn' }).click();
  await page
    .getByRole('group', { name: 'Kleur van speler 2' })
    .getByRole('button', { name: 'Blauw', exact: true })
    .click();
  await page.getByRole('button', { name: /^(Aftrappen!|Start het spel)$/ }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'snoep');
  await expect(page.locator('.score-chip').nth(1)).toContainText('🦄');

  // The theme is stored in the history from the first roll.
  await page.getByRole('button', { name: /^Gooien!/ }).click();
  const games = await (await page.request.get('/api/games?pageSize=1')).json();
  expect(games.items[0].theme).toBe('snoep');
  expect(games.items[0].players[1]).toMatchObject({ avatar: 'unicorn', colour: '#1f6fd1' });

  // The laptop remembers the theme for the next game.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'snoep');
});

test('the sound can be switched off and stays off on this device', async ({ page }) => {
  await startGame(page, 'Voetbalstadion', ['Emma', 'Sara']);
  await page.getByRole('button', { name: 'Geluid uit' }).click();
  await expect(page.getByRole('button', { name: 'Geluid aan' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Geluid aan' })).toBeVisible();
  await page.getByRole('button', { name: 'Geluid aan' }).click();
  await expect(page.getByRole('button', { name: 'Geluid uit' })).toBeVisible();
});

test.describe('with animations', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a turn changes quietly: the ring moves on, no pop-up', async ({ page }) => {
    await startGame(page, 'Voetbalstadion', ['Noor', 'Lieke']);
    const current = page.locator('.score-chip.current');
    await expect(current).toContainText('Noor');
    await expect(page.getByRole('heading', { name: 'Noor is aan de beurt' })).toBeVisible();

    // Noor plays a turn; nothing needs to be tapped away before Lieke can roll.
    await page.getByRole('button', { name: /^Gooien!/ }).click();
    await page.waitForTimeout(1000);
    await page.locator('.scorecard button.choose:enabled').first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Ja!' }).click();

    await expect(current).toContainText('Lieke');
    await expect(current.locator('.turn-pulse')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Lieke is aan de beurt' })).toBeVisible();
    await expect(page.locator('.dice.empty')).toBeVisible();
    await expect(page.locator('.turn-overlay, .backdrop')).toHaveCount(0);
    await page.getByRole('button', { name: /^Gooien!/ }).click();
    await expect(page.locator('.dice.empty')).toHaveCount(0);
  });

  test('the laptop throws 3D dice that land on the rolled values; a tap skips', async ({
    page,
  }) => {
    await startGame(page, 'Snoepwinkel', ['Emma', 'Sara']);
    await expect(page.locator('.dice-canvas')).toBeVisible();
    await expect(page.locator('.button-dice')).toBeVisible();

    await page.getByRole('button', { name: /^Gooien!/ }).click();
    // The first tap during the throw only skips it: no die is held.
    await page.getByRole('button', { name: /^Dobbelsteen 1/ }).click();
    await expect(page.getByText('Vast', { exact: true })).toBeHidden();
    await page.getByRole('button', { name: /^Dobbelsteen 1/ }).click();
    await expect(
      page.getByRole('button', { name: /^Dobbelsteen 1: \d, vastgehouden/ }),
    ).toBeVisible();
  });
});
