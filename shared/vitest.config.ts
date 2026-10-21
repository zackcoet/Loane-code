import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the TypeScript sources. Without this, vitest also found the
    // compiled copies in lib/ after a build and ran every test twice.
    include: ['src/**/*.test.ts'],
  },
});
