import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

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
  webServer: {
    command: `rm -f data/e2e.db* && npm run build -w @yahtzee/web && NODE_ENV=test SERVE_WEB=1 YAHTZEE_SEED=2026 YAHTZEE_DB=data/e2e.db PORT=${PORT} npx tsx packages/server/src/index.ts`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
