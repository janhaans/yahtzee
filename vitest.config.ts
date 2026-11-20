import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Game rules, the game history and the pure fun logic (events, messages, dice faces)
      // must be fully tested.
      include: [
        'packages/game-logic/src/**/*.ts',
        'packages/server/src/history/**/*.ts',
        'packages/web/src/fun/**/*.ts',
        'packages/web/src/dice3d/faces.ts',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
