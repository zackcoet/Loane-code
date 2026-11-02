/**
 * Turn email verification on or off.
 *
 * THE PANIC BUTTON. If Gmail starts bouncing at two in the morning,
 * this is how every new student gets in again — one command, no
 * deploy, no App Store review:
 *
 *   npx tsx scripts/setVerification.ts off --project loane-code
 *
 * The app, the Cloud Functions and the security rules all read the
 * same document, `config/verification`, so this is genuinely the whole
 * switch and not just one layer of it. A missing document means off.
 *
 * With no on/off argument it just reports the current state.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@loane/shared';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const projectId = arg('project');
// argv[2] is only a mode when it IS one — otherwise it is --project,
// and reading it as a mode made the no-argument "just tell me the
// current state" call fail with a usage error.
const mode = process.argv[2] === 'on' || process.argv[2] === 'off' ? process.argv[2] : undefined;

if (!projectId) {
  console.error('Pass --project, e.g. --project loane-code');
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);
const ref = db.collection(COLLECTIONS.config).doc('verification');

(async () => {
  const before = (await ref.get()).data() as { required?: boolean } | undefined;
  const was = before?.required === true;

  if (!mode) {
    console.log(`\n${projectId}: email verification is ${was ? 'ON' : 'OFF'}\n`);
    return;
  }

  const required = mode === 'on';
  await ref.set({ required, updatedAt: Timestamp.now() }, { merge: true });

  console.log(`\n${projectId}: email verification ${was ? 'ON' : 'OFF'} -> ${required ? 'ON' : 'OFF'}`);
  if (required) {
    console.log('New students must now type a code from their school inbox.');
    console.log('Anyone already marked emailConfirmed is unaffected.\n');
  } else {
    console.log('Nobody is blocked. New students get straight in.\n');
  }
})().catch((error) => {
  console.error('FAILED:', (error as Error).message);
  process.exit(1);
});
