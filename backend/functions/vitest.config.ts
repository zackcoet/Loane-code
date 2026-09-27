import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // The emulator can be slow on a cold start.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globals: true,
  },
});
