/**
 * Grant the admin custom claim to an account.
 *
 *     npx tsx scripts/grantAdmin.ts someone@joinloane.com
 *
 * Admin is a Firebase custom claim, not a database field — a field is
 * something someone might eventually find a way to write. Granting it is a
 * deliberate manual act, never something the app can trigger.
 *
 * By default this runs against the EMULATOR. To grant admin on a real
 * project you must set GOOGLE_APPLICATION_CREDENTIALS and pass --live, and
 * it will ask you to confirm the project name.
 */

import { initializeApp, deleteApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

async function main(): Promise<void> {
  const email = process.argv[2];
  const live = process.argv.includes('--live');

  if (!email) {
    console.error('Usage: npx tsx scripts/grantAdmin.ts <email> [--live]');
    process.exit(1);
  }

  if (!live) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
    process.env.GCLOUD_PROJECT ??= 'demo-loane';
  } else if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('--live needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service account.');
    process.exit(1);
  }

  const app = initializeApp(
    live
      ? { credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT }
      : { projectId: process.env.GCLOUD_PROJECT },
  );

  const auth = getAuth(app);
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { admin: true });

  console.warn(`Granted admin to ${email} (${user.uid}) on ${process.env.GCLOUD_PROJECT}.`);
  console.warn('They must sign out and back in for the claim to take effect.');

  await deleteApp(app);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
