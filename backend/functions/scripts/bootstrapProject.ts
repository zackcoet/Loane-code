/**
 * Bring a REAL Firebase project up to the minimum a working Loane needs.
 *
 * Two things, and deliberately only two:
 *   1. the campus document — signup checks the email domain against this
 *      collection, so without it every signup is rejected
 *   2. an admin — the dashboard is useless without one
 *
 * IT DOES NOT SEED FAKE DATA. seed.ts fills an emulator with believable
 * students so screens are not empty; putting those into a live project
 * would mean real users scrolling a feed of people who do not exist.
 * This script is the other thing: the scaffolding a real project needs
 * before the first real person signs up.
 *
 * Safe to run twice. Everything here is a merge or a no-op.
 *
 *   npx tsx scripts/bootstrapProject.ts --project loane-code \
 *     --admin zackcoetzee123@gmail.com
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS, type Campus } from '@loane/shared';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const projectId = arg('project');
const adminEmail = arg('admin');

if (!projectId) {
  console.error('Which project? Pass --project <id>.');
  process.exit(1);
}
if (projectId.startsWith('demo-')) {
  console.error(
    `Refusing: ${projectId} is an emulator project. Use "npm run seed" for that.`,
  );
  process.exit(1);
}
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing: FIRESTORE_EMULATOR_HOST is set, so this would hit the emulator.');
  process.exit(1);
}

const CAMPUS_ID = 'university-of-south-carolina';

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const auth = getAuth();

async function main(): Promise<void> {
  console.warn(`Bootstrapping ${projectId}\n`);

  // --- The campus ---------------------------------------------------------
  const ref = db.collection(COLLECTIONS.campuses).doc(CAMPUS_ID);
  const existing = await ref.get();

  const campus: Omit<Campus, 'createdAt' | 'updatedAt'> = {
    id: CAMPUS_ID,
    name: 'University of South Carolina',
    shortName: 'USC',
    emailDomains: ['sc.edu', 'email.sc.edu'],
    city: 'Columbia',
    state: 'SC',
    // USC garnet. The colour only — never the university's logo, which
    // is trademarked.
    brandColor: '#73000A',
    isLive: true,
    stats: {
      userCount: 0,
      verifiedUserCount: 0,
      listingCount: 0,
      postCount: 0,
      bookingCount: 0,
    },
  };

  if (existing.exists) {
    // Never reset the counters on a project that has been running.
    const { stats: _ignored, ...rest } = campus;
    await ref.set({ ...rest, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.warn('Campus already there — refreshed its details, left the counters alone.');
  } else {
    await ref.set({
      ...campus,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.warn('Created campus: University of South Carolina (sc.edu, email.sc.edu)');
  }

  // --- The admin ----------------------------------------------------------
  if (!adminEmail) {
    console.warn('\nNo --admin given, so nobody was promoted.');
    return;
  }

  let user;
  try {
    user = await auth.getUserByEmail(adminEmail);
  } catch {
    console.warn(
      `\nNo account for ${adminEmail} on ${projectId} yet.\n` +
        '  Sign in once through the app or the dashboard, then run this again\n' +
        '  to promote it. We do not create the login here because that would\n' +
        '  mean choosing somebody a password.',
    );
    return;
  }

  // The claim is what the security rules read. A role field in Firestore
  // is a field, and a field is something somebody might find a way to
  // write — see the isAdmin() helper in firestore.rules.
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.warn(`\nAdmin claim set on ${adminEmail} (${user.uid})`);

  // Keep the profile document in step, when there is one, so the admin
  // dashboard's own user list agrees with the claim.
  const profile = db.collection(COLLECTIONS.users).doc(user.uid);
  if ((await profile.get()).exists) {
    await profile.set({ role: 'admin', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.warn('Profile document marked role: admin');
  } else {
    console.warn('No profile document yet — the claim is set and is what the rules check.');
  }

  console.warn('\nShe must sign out and back in for a new claim to take effect.');
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Bootstrap failed:', error);
    process.exit(1);
  });
