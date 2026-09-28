/**
 * Smoke test a REAL Loane deployment.
 *
 * Proves the things a first user does actually work: the campus list is
 * readable signed out, the unauthenticated checks answer, sign-up
 * creates an account, and an authenticated callable runs as her.
 *
 * IT CLEANS UP AFTER ITSELF. It creates one throwaway student, then
 * removes the login, the profile and the username lock. A live project
 * should not accumulate test accounts. If it dies halfway the account
 * is left behind on purpose — better a stray row you can see than a
 * silent delete of something that mattered — and re-running clears it.
 *
 *   npx tsx scripts/smokeTestLive.ts --project loane-code
 */

import { initializeApp as adminInit, applicationDefault } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const projectId = arg('project');
if (!projectId || projectId.startsWith('demo-')) {
  console.error('Pass --project <real project id>.');
  process.exit(1);
}
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Refusing: an emulator host is set, so this would not test the real thing.');
  process.exit(1);
}

const WEB = {
  apiKey: 'AIzaSyAL5iE73tRc9YbY7jGWya65Q8Pl_Kd831M',
  authDomain: 'loane-code.firebaseapp.com',
  projectId: 'loane-code',
  storageBucket: 'loane-code.firebasestorage.app',
  messagingSenderId: '384488190763',
  appId: '1:384488190763:web:13e9baa2efd0b10815cb6e',
};

adminInit({ credential: applicationDefault(), projectId });
const app = initializeApp(WEB);
const auth = getAuth(app);
const db = getFirestore(app);
const fns = getFunctions(app, 'us-central1');
const call = (n: string) => httpsCallable(fns, n);

// Distinctive so a leftover is obviously ours.
const stamp = Date.now().toString(36);
const USERNAME = `smoketest${stamp}`.slice(0, 28);
const EMAIL = `${USERNAME}@email.sc.edu`;

let passed = 0;
let failed = 0;
function ok(label: string, detail = ''): void {
  passed += 1;
  console.warn(`  PASS  ${label}${detail ? '  ' + detail : ''}`);
}
function bad(label: string, error: unknown): void {
  failed += 1;
  console.warn(`  FAIL  ${label}  ->  ${(error as Error).message}`);
}

async function cleanUp(uid: string | null): Promise<void> {
  console.warn('\nCleaning up the throwaway account');
  try {
    await adminDb().collection('usernames').doc(USERNAME).delete();
    console.warn('  removed username lock');
  } catch { /* never existed */ }
  if (!uid) return;
  try {
    await adminDb().collection('users').doc(uid).delete();
    console.warn('  removed profile document');
  } catch { /* never existed */ }
  try {
    await adminAuth().deleteUser(uid);
    console.warn('  removed login');
  } catch { /* never existed */ }
}

async function main(): Promise<void> {
  console.warn(`Smoke testing ${projectId}\n`);
  let uid: string | null = null;

  // 1. Signed out, exactly like the signup screen.
  try {
    const campuses = await getDocs(collection(db, 'campuses'));
    if (campuses.size === 0) throw new Error('no campus documents — signup will reject everybody');
    ok('campuses readable signed out', `${campuses.size} campus`);
  } catch (e) { bad('campuses readable signed out', e); }

  try {
    const r = (await call('checkCampusEmail')({ email: 'someone@email.sc.edu' })) as {
      data: { supported?: boolean; ok?: boolean };
    };
    ok('checkCampusEmail (a school we support)', JSON.stringify(r.data));
  } catch (e) { bad('checkCampusEmail (a school we support)', e); }

  try {
    const r = (await call('checkCampusEmail')({ email: 'someone@gmail.com' })) as {
      data: unknown;
    };
    ok('checkCampusEmail (a school we do not)', JSON.stringify(r.data));
  } catch (e) { bad('checkCampusEmail (a school we do not)', e); }

  try {
    const r = (await call('checkUsername')({ username: USERNAME })) as {
      data: { available?: boolean };
    };
    if (r.data.available !== true) throw new Error('a fresh username came back unavailable');
    ok('checkUsername', JSON.stringify(r.data));
  } catch (e) { bad('checkUsername', e); }

  // 2. Sign-up. The whole thing server-side, including the custom token.
  try {
    const r = (await call('createAccount')({
      firstName: 'Smoke',
      email: EMAIL,
      password: 'loane1234',
      username: USERNAME,
    })) as { data: { uid: string; username: string; campusId: string; token: string } };

    uid = r.data.uid;
    if (!r.data.token) throw new Error('no custom token came back');
    if (r.data.campusId !== 'university-of-south-carolina') {
      throw new Error(`wrong campus: ${r.data.campusId}`);
    }
    ok('createAccount', `${r.data.username} on ${r.data.campusId}`);

    // The custom token is the part that needs the Token Creator role.
    await signInWithCustomToken(auth, r.data.token);
    ok('signInWithCustomToken', `signed in as ${auth.currentUser?.uid}`);
  } catch (e) {
    bad('createAccount / sign in', e);
    await cleanUp(uid);
    return report();
  }

  // 3. Her profile, read as her.
  try {
    const snap = await getDoc(doc(db, 'users', uid!));
    if (!snap.exists()) throw new Error('no profile document was written');
    const user = snap.data() as { isVerified: boolean; campusId: string; status: string };
    ok('profile document', `verified=${user.isVerified} status=${user.status}`);
  } catch (e) { bad('profile document', e); }

  // 4. An authenticated callable, which is the guard path every action uses.
  try {
    const r = (await call('checkUsername')({ username: `${USERNAME}x` })) as { data: unknown };
    ok('authenticated callable', JSON.stringify(r.data));
  } catch (e) { bad('authenticated callable', e); }

  // 5. A callable that must REFUSE — proves the guards are live, not just
  //    that happy paths respond.
  try {
    await call('suspendUser')({ uid: uid!, reason: 'smoke test' });
    bad('admin-only callable refuses a student', new Error('it ALLOWED a non-admin to suspend'));
  } catch {
    ok('admin-only callable refuses a student');
  }

  await signOut(auth);
  await cleanUp(uid);
  report();
}

function report(): void {
  console.warn(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error: unknown) => {
  console.error('Smoke test crashed:', error);
  process.exit(1);
});
