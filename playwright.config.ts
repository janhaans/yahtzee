import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
/** A second server whose very first roll is a Yahtzee (seed 253 rolls 3 3 3 3 3). */
export const YAHTZEE_PORT = 3101;

// The server holds one game, so the tests run one after another against a single server.
// YAHTZEE_SEED makes the dice predictable; it is ignored by `npm start`.
// Every run starts with an empty history in data/e2e.db, so no "unfinished game" is waiting.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices['Desktop Chrome'],
    // Dice land at once and banners are skipped, so the tests do not wait for animations.
    reducedMotion: 'reduce',
  },
  // The servers start in this order, so the second one can use the web app the first built.
  webServer: [
    {
      command: `rm -f data/e2e.db* && npm run build -w @yahtzee/web && NODE_ENV=test SERVE_WEB=1 YAHTZEE_SEED=2026 YAHTZEE_DB=data/e2e.db PORT=${PORT} npx tsx packages/server/src/index.ts`,
      url: `http://127.0.0.1:${PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `rm -f data/e2e-yahtzee.db* && NODE_ENV=test SERVE_WEB=1 YAHTZEE_SEED=253 YAHTZEE_DB=data/e2e-yahtzee.db PORT=${YAHTZEE_PORT} npx tsx packages/server/src/index.ts`,
      url: `http://127.0.0.1:${YAHTZEE_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
