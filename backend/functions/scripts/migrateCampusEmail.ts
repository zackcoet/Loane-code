/**
 * Move campusEmail off the public user document.
 *
 * It used to live on `users/{uid}`, which every signed-in student can
 * read — so every student could read every other student's school
 * address. Firestore rules are all-or-nothing per document, so there is
 * no way to hide one field: it has to move to `users/{uid}/private/settings`.
 *
 * For each user this copies the address into her private document (if
 * it is not already there) and then deletes it from the public one.
 * Both in a single batch per user, so a user is never left with the
 * address in neither place.
 *
 * Safe to run twice. Pass --dry-run first.
 *
 *   npx tsx scripts/migrateCampusEmail.ts --project loane-code --dry-run
 *   npx tsx scripts/migrateCampusEmail.ts --project loane-code
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const projectId = arg('project');
const dryRun = process.argv.includes('--dry-run');

if (!projectId) {
  console.error('Pass --project <id>.');
  process.exit(1);
}
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing: FIRESTORE_EMULATOR_HOST is set. Re-seed the emulator instead.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

async function main(): Promise<void> {
  console.warn(`${dryRun ? 'DRY RUN on' : 'Migrating'} ${projectId}\n`);

  const users = await db.collection('users').get();
  let moved = 0;
  let alreadyDone = 0;
  let nothingToMove = 0;

  for (const snap of users.docs) {
    const data = snap.data() as { campusEmail?: string | null; username?: string };
    const email = data.campusEmail;
    const who = data.username ?? snap.id;

    if (email === undefined) {
      // Already migrated, or never had one.
      const priv = await snap.ref.collection('private').doc('settings').get();
      if (priv.exists && (priv.data() as { campusEmail?: string }).campusEmail) alreadyDone += 1;
      else nothingToMove += 1;
      continue;
    }

    if (dryRun) {
      console.warn(`  would move  ${who.padEnd(24)} ${email ?? '(null)'}`);
      moved += 1;
      continue;
    }

    const batch = db.batch();
    // Written first, removed second, in one atomic commit — she is never
    // left with the address in neither document.
    batch.set(
      snap.ref.collection('private').doc('settings'),
      { uid: snap.id, campusEmail: email ?? null, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    batch.update(snap.ref, {
      campusEmail: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    console.warn(`  moved       ${who.padEnd(24)} ${email ?? '(null)'}`);
    moved += 1;
  }

  console.warn(
    `\n${dryRun ? 'would move' : 'moved'}: ${moved}  ·  already private: ${alreadyDone}  ·  nothing to move: ${nothingToMove}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
