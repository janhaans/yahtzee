import { expect, test } from '@playwright/test';
import { YAHTZEE_PORT } from '../playwright.config';

// This server's first roll is a Yahtzee of threes, so this file has a single test.
test.use({ baseURL: `http://127.0.0.1:${YAHTZEE_PORT}`, reducedMotion: 'no-preference' });

test('a Yahtzee gets a giant celebration that a tap can end', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Voetbalstadion' }).click();
  await page.getByRole('button', { name: 'Nieuw spel' }).click();
  await page.getByRole('textbox').nth(0).fill('Emma');
  await page.getByRole('textbox').nth(1).fill('Sara');
  await page.getByRole('button', { name: /^(Aftrappen!|Start het spel)$/ }).click();

  await page.getByRole('button', { name: /^Gooien!/ }).click();
  const party = page.locator('.celebration');
  await expect(party).toContainText('YAHTZEE!!!');
  await expect(party).toContainText('GOOOAL!');
  await expect(page.getByRole('button', { name: 'Dobbelsteen 1: 3' })).toBeVisible();
  await party.click();
  await expect(party).toBeHidden();

  // Scoring the Yahtzee gives 50 points and a cheerful message.
  await page.locator('.scorecard button.choose', { hasText: '50' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ja!' }).click();
  await expect(page.locator('.fun-message .bubble')).toBeVisible();
  await expect(page.locator('.score-chip').first()).toContainText('50');
});
