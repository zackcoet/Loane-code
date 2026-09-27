import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // @loane/shared is TypeScript source, not a built package, so Vite has to
  // be told not to try to pre-bundle it as a dependency.
  optimizeDeps: { exclude: ['@loane/shared'] },
});
