/**
 * Recount how many students each campus has, from the accounts themselves.
 *
 * WHY THIS EXISTS: until run 46, sign-up wrote its +1 to a field
 * literally named "stats.userCount" (a dotted key in a merge write is
 * not a path), so the real `stats.userCount` never went up — while
 * deleting an account did count it down. The live counts are therefore
 * wrong (possibly below zero). They feed the "Join 120+ girls at USC"
 * line and the dashboard's Campuses page.
 *
 * Read-only by default: it prints what it would change. Add --write to
 * save. Safe to run twice.
 *
 *   npx tsx scripts/recountCampusStudents.ts --project loane-dev
 *   npx tsx scripts/recountCampusStudents.ts --project loane-code --write   (ask Zack first)
 *
 * Against the emulator:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   npx tsx scripts/recountCampusStudents.ts --project demo-loane --write
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@loane/shared';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const projectId = arg('project');
const write = process.argv.includes('--write');
if (!projectId) {
  console.error('Which project? Pass --project <id>.');
  process.exit(1);
}

initializeApp(
  process.env.FIRESTORE_EMULATOR_HOST
    ? { projectId }
    : { credential: applicationDefault(), projectId },
);
const db = getFirestore();

async function main(): Promise<void> {
  // A deleted account stays as a "Deleted account" shell, and is not a student any more.
  const counts = new Map<string, { users: number; verified: number }>();
  const users = await db
    .collection(COLLECTIONS.users)
    .select('campusId', 'status', 'isVerified')
    .get();
  for (const doc of users.docs) {
    const { campusId, status, isVerified } = doc.data();
    if (typeof campusId !== 'string' || status === 'deactivated') continue;
    const c = counts.get(campusId) ?? { users: 0, verified: 0 };
    c.users += 1;
    if (isVerified === true) c.verified += 1;
    counts.set(campusId, c);
  }

  const campuses = await db.collection(COLLECTIONS.campuses).get();
  for (const doc of campuses.docs) {
    const data = doc.data();
    const now = { users: data.stats?.userCount, verified: data.stats?.verifiedUserCount };
    const real = counts.get(doc.id) ?? { users: 0, verified: 0 };
    const stray = 'stats.userCount' in data || 'stats.verifiedUserCount' in data;
    const changed = now.users !== real.users || now.verified !== real.verified || stray;
    console.warn(
      `${changed ? 'FIX ' : 'ok  '} ${doc.id}: ${now.users ?? '—'} → ${real.users} students` +
        (stray ? ' (removing the stray "stats.userCount" field)' : ''),
    );
    if (!changed || !write) continue;
    await doc.ref.update(
      'stats.userCount',
      real.users,
      'stats.verifiedUserCount',
      real.verified,
      new FieldPath('stats.userCount'),
      FieldValue.delete(),
      new FieldPath('stats.verifiedUserCount'),
      FieldValue.delete(),
    );
  }
  console.warn(write ? '\nSaved.' : '\nNothing saved. Add --write to save.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
