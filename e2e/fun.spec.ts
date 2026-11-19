import { expect, test, type Page } from '@playwright/test';

/** Opens the start screen with no game running. */
async function openStart(page: Page) {
  await page.goto('/');
  const stop = page.getByRole('button', { name: 'Stop spel' });
  await expect(stop.or(page.getByRole('button', { name: 'Nieuw spel' }))).toBeVisible();
  if (await stop.isVisible()) {
    await stop.click();
    await page.getByRole('button', { name: 'Ja, stoppen' }).click();
  }
}

async function startGame(page: Page, theme: string, names: string[]) {
  await openStart(page);
  await page.getByRole('button', { name: theme }).click();
  await page.getByRole('button', { name: 'Nieuw spel' }).click();
  const inputs = page.getByRole('textbox');
  for (const [i, name] of names.entries()) await inputs.nth(i).fill(name);
  await page.getByRole('button', { name: 'Start!' }).click();
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
  await page.getByRole('button', { name: 'Start!' }).click();

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

test.describe('with animations', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a big turn banner shows whose turn it is; a tap skips it', async ({ page }) => {
    await startGame(page, 'Voetbalstadion', ['Noor', 'Lieke']);
    const banner = page.locator('.turn-overlay');
    await expect(banner).toContainText('Noor is aan de beurt!');
    await expect(banner).toContainText('Aan de bal!');
    await banner.click();
    await expect(banner).toBeHidden();
  });
});
