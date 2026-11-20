import { expect, test, type Page } from '@playwright/test';

// 1366 x 650 is what a browser window really leaves on a 1366 x 768 laptop screen.
const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1366, height: 650 },
  { width: 1920, height: 1080 },
];

const MIN_TAP = 48;
const MIN_FONT = 16;

/** Starts a 4-player game (the widest top bar) with long names, rolls and holds one die. */
async function startBusyGame(page: Page) {
  await page.goto('/');
  const stop = page.getByRole('button', { name: 'Stop spel' });
  const newGame = page.getByRole('button', { name: 'Nieuw spel' });
  await expect(stop.or(newGame)).toBeVisible();
  if (await stop.isVisible()) {
    await stop.click();
    await page.getByRole('button', { name: 'Ja, stoppen' }).click();
  }
  await newGame.click();
  const add = page.getByRole('button', { name: '+ Speler toevoegen' });
  await add.click();
  await add.click();
  const names = ['Anne-Marijke Jo', 'Wilhelmina Sara', 'Noor', 'Lieke'];
  for (const [i, name] of names.entries()) await page.getByRole('textbox').nth(i).fill(name);
  await page.getByRole('button', { name: /^(Aftrappen!|Start het spel)$/ }).click();

  await page.getByRole('button', { name: /^Gooien!/ }).click();
  await page.getByRole('button', { name: /^Dobbelsteen 1/ }).click();
  await expect(page.getByText('Vast')).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test(`game screen fits ${viewport.width}x${viewport.height} without scrolling`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await startBusyGame(page);

    await testInfo.attach(`game-${viewport.width}x${viewport.height}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    const size = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(size.scrollHeight, 'no vertical scrollbar').toBeLessThanOrEqual(viewport.height);
    expect(size.scrollWidth, 'no horizontal scrollbar').toBeLessThanOrEqual(viewport.width);

    // Every button can be tapped on a 48 x 48 px area. Small buttons (like the (i) buttons)
    // count when the whole 48 x 48 square around their centre still hits them.
    const smallButtons = await page.evaluate((min) => {
      const half = min / 2 - 1;
      return [...document.querySelectorAll<HTMLElement>('.game-screen button')]
        .filter((button) => {
          const r = button.getBoundingClientRect();
          if (r.width >= min && r.height >= min) return false;
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          const corners = [
            [x - half, y - half],
            [x + half, y - half],
            [x - half, y + half],
            [x + half, y + half],
          ] as const;
          return !corners.every(([cx, cy]) => button.contains(document.elementFromPoint(cx, cy)));
        })
        .map((button) => button.getAttribute('aria-label') ?? button.textContent);
    }, MIN_TAP);
    expect(smallButtons, 'buttons smaller than 48 x 48 px').toEqual([]);

    // Every visible piece of text is at least 16 px.
    const smallText = await page.evaluate((min) => {
      return [...document.querySelectorAll<HTMLElement>('.game-screen *')]
        .filter((el) =>
          [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()),
        )
        .filter((el) => el.getClientRects().length > 0)
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < min)
        .map((el) => `${el.textContent} (${getComputedStyle(el).fontSize})`);
    }, MIN_FONT);
    expect(smallText, 'text smaller than 16 px').toEqual([]);
  });
}
