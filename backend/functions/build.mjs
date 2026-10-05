/**
 * Bundle Cloud Functions for deploy.
 *
 * Firebase uploads only the `backend/functions` folder. Our code imports
 * `@loane/shared`, which lives outside that folder as an npm workspace
 * symlink — that symlink would not survive the upload. So we bundle the
 * shared code directly into the output instead.
 *
 * `@loane/shared` must NOT appear in package.json at all, not even under
 * devDependencies: Cloud Build runs `npm install --package-lock-only`,
 * which resolves dev dependencies too, and then fails trying to fetch
 * `@loane/shared` from the public registry.
 *
 * Real npm packages stay external and are installed from package.json on
 * Google's side. Bundling them would be slower and larger for no benefit,
 * and `stripe` in particular is a large library that expects to be a real
 * module on disk.
 */

import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['firebase-admin', 'firebase-functions', 'stripe'],
  logLevel: 'info',
});
