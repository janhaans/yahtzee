import { expect, type Page } from '@playwright/test';

/** Opens the game table with no game running and no setup left open by an earlier test. */
export async function openStart(page: Page) {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Menu' });
  const newGame = page.getByRole('button', { name: 'Nieuw spel' });
  const back = page.getByRole('button', { name: 'Terug' });
  await expect(menu.or(newGame).or(back)).toBeVisible();
  if (await back.isVisible()) await back.click();
  await expect(menu.or(newGame)).toBeVisible();
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('button', { name: 'Stop spel' }).click();
    await page.getByRole('button', { name: 'Ja, stoppen' }).click();
  }
}

/** Opens player setup on a free game table. */
export async function openSetup(page: Page) {
  await openStart(page);
  await page.getByRole('button', { name: 'Nieuw spel' }).click();
  await expect(page.getByRole('heading', { name: 'Wie doen er mee?' })).toBeVisible();
}
