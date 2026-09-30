/**
 * Bundle Cloud Functions for deploy.
 *
 * Firebase uploads only the `backend/functions` folder. Our code imports
 * `@loane/shared`, which lives outside that folder as an npm workspace
 * symlink — that symlink would not survive the upload. So we bundle the
 * shared code directly into the output instead.
 *
 * firebase-admin and firebase-functions stay external: they are installed
 * from package.json on Google's side, and bundling them would be slower
 * and larger for no benefit.
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
  external: ['firebase-admin', 'firebase-functions'],
  logLevel: 'info',
});
