/**
 * npm run check:indexes
 *
 * Fails if any Firestore query in the code is missing the index
 * production needs. The emulator never enforces indexes, so this is the
 * only thing standing between a green laptop and a crash on the live
 * project. See indexCheck.ts for how it works.
 */

import * as path from 'node:path';
import { checkRepo } from './indexCheck';

const root = path.resolve(__dirname, '../../..');
const report = checkRepo(root);

for (const u of report.reviewed) {
  console.warn(`  reviewed     ${u.file}:${u.line} — ${u.reason}`);
}
for (const u of report.unchecked) {
  console.warn(`  not checked  ${u.file}:${u.line} — ${u.reason}`);
}
for (const p of report.problems) {
  console.error(`  MISSING      ${p.query.file}:${p.query.line} — ${p.message}`);
}
console.warn(
  `\n${report.checked} queries checked, ${report.problems.length} missing an index, ` +
    `${report.reviewed.length} vouched for by hand, ${report.unchecked.length} unreadable and unvouched.`,
);
if (report.unchecked.length > 0) {
  console.warn(
    `\nAdd a comment containing "index-check:" just above each unreadable query, ` +
      `saying why it needs no composite index — or rewrite it so the field names are plain.`,
  );
}
process.exit(report.problems.length > 0 || report.unchecked.length > 0 ? 1 : 0);
