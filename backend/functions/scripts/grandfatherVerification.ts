/**
 * Mark the accounts that already existed as email-confirmed.
 *
 * WHY THIS EXISTS. Email verification went in on 2026-11-02. Everybody
 * who signed up before that typed a school address and was let in, so
 * none of them has ever confirmed anything. The moment verification is
 * switched on they would all be sent to a code screen. Zack's call was
 * to let the accounts that already existed through.
 *
 * verificationMethod becomes 'manual_admin', NOT 'email_confirmed'.
 * That is the honest record: nobody proved these inboxes, a human
 * decided to trust them. Writing 'email_confirmed' would put a lie in
 * the database that nothing could later untangle — and the whole
 * reason verificationMethod exists is to know which accounts were
 * never actually proven.
 *
 * SAFE TO READ FIRST. It is a dry run unless you pass --write, and it
 * only ever touches accounts created BEFORE the cutoff below, so
 * running it twice cannot grandfather somebody who signed up in the
 * meantime.
 *
 *   npx tsx scripts/grandfatherVerification.ts --project loane-code
 *   npx tsx scripts/grandfatherVerification.ts --project loane-code --write
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@loane/shared';

/**
 * Nobody who signed up after this is grandfathered.
 *
 * The date verification shipped. An account created after it went live
 * went through the code screen like everybody else, and quietly
 * confirming it would hide a real failure.
 */
const CUTOFF = new Date('2026-11-03T00:00:00Z');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const projectId = arg('project');
const write = process.argv.includes('--write');

if (!projectId) {
  console.error('Pass --project, e.g. --project loane-code');
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);

(async () => {
  console.log(`\nProject: ${projectId}`);
  console.log(`Mode:    ${write ? 'WRITING' : 'dry run (pass --write to apply)'}`);
  console.log(`Cutoff:  accounts created before ${CUTOFF.toISOString()}\n`);

  const users = await db.collection(COLLECTIONS.users).get();

  const toChange = users.docs.filter((d) => {
    const u = d.data();
    if (u.emailConfirmed === true) return false;
    const created = (u.createdAt as Timestamp | undefined)?.toDate?.();
    // No createdAt at all means it predates us caring, so it is old.
    return !created || created < CUTOFF;
  });

  console.log(`${users.size} accounts, ${toChange.length} to grandfather.`);
  // Usernames, not emails: enough to recognise an account, not a list
  // of real students' addresses printed to a terminal.
  for (const d of toChange) {
    console.log(`  @${d.get('username') ?? d.id}  (${d.get('status') ?? 'no status'})`);
  }

  if (!write) {
    console.log('\nNothing written. Re-run with --write to apply.\n');
    return;
  }

  const batch = db.batch();
  for (const d of toChange) {
    batch.update(d.ref, {
      emailConfirmed: true,
      emailConfirmedAt: Timestamp.now(),
      verificationMethod: 'manual_admin',
      updatedAt: Timestamp.now(),
    });
  }
  await batch.commit();

  console.log(`\nDone. ${toChange.length} accounts grandfathered.\n`);
})().catch((error) => {
  console.error('FAILED:', (error as Error).message);
  process.exit(1);
});
