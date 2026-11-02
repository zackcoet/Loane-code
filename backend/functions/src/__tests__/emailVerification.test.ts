/**
 * Email verification — the real functions, not a re-implementation.
 *
 * These call `sendVerificationCode` and `confirmVerificationCode`
 * through `.run()`, so what is tested is the code that will be
 * deployed. A test that re-implements the rule it is checking passes
 * happily while the real thing is broken, which is the failure mode
 * worth avoiding here: this is the only thing standing between Loane
 * and anybody who can type a .edu address.
 *
 * THE CODE IS NEVER RETURNED BY ANYTHING. To check a *correct* code
 * these tests have to do what an attacker cannot: read the stored
 * hash and brute-force six digits against it. That takes a moment and
 * is the point — the stored form is not reversible, so proving the
 * happy path means proving that too.
 *
 * No email is sent: without GMAIL_APP_PASSWORD the sender logs to the
 * console and returns, which is exactly the emulator path.
 *
 * Run the emulators first:  npm run emulators
 */

import { createHash } from 'node:crypto';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane-verification';
const UID = 'uid-ella';
const EMAIL = 'ellapetrickcloset@email.sc.edu';

let app: App;
let db: Firestore;

type Callable<T> = { run: (request: unknown) => Promise<T> };
let sendVerificationCode: Callable<{ sent: true; expiresInMinutes: number }>;
let confirmVerificationCode: Callable<{ confirmed: true }>;

/** A signed-in request from our student. */
const asElla = (data: unknown = {}) => ({ auth: { uid: UID, token: {} }, data });

async function seedStudent(overrides: Record<string, unknown> = {}) {
  await db
    .collection(COLLECTIONS.users)
    .doc(UID)
    .set({
      uid: UID,
      firstName: 'Ella',
      status: 'active',
      role: 'student',
      isVerified: true,
      emailConfirmed: false,
      ...overrides,
    });
  await db
    .collection(COLLECTIONS.users)
    .doc(UID)
    .collection('private')
    .doc('settings')
    .set({ uid: UID, campusEmail: EMAIL });
}

function pending() {
  const key = createHash('sha256').update(EMAIL).digest('hex');
  return db.collection(COLLECTIONS.emailVerifications).doc(key);
}

/**
 * The code that was just issued.
 *
 * Only possible because we hold the hash AND the salt, and because
 * six digits is a small space. That is precisely the attack the
 * attempt limit exists to stop — nobody gets a million tries.
 */
async function currentCode(): Promise<string> {
  const hash = (await pending().get()).get('codeHash') as string;
  for (let n = 0; n < 1_000_000; n += 1) {
    const guess = String(n).padStart(6, '0');
    if (createHash('sha256').update(`${EMAIL}:${guess}`).digest('hex') === hash) return guess;
  }
  throw new Error('No code matched the stored hash.');
}

/** Runs a callable and reports whether it threw, and with what message. */
async function attempt<T>(fn: Callable<T>, data: unknown = {}) {
  try {
    return { ok: true, message: '', result: await fn.run(asElla(data)) };
  } catch (error) {
    return { ok: false, message: (error as { message?: string }).message ?? '', result: null };
  }
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  // Makes the sender take its "log it, don't send it" path.
  process.env.FUNCTIONS_EMULATOR = 'true';
  app = initializeApp({ projectId: PROJECT }, 'verification-tests');
  db = getFirestore(app);
  ({ sendVerificationCode, confirmVerificationCode } = (await import(
    '../auth/emailVerification'
  )) as unknown as {
    sendVerificationCode: typeof sendVerificationCode;
    confirmVerificationCode: typeof confirmVerificationCode;
  });
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection(COLLECTIONS.users));
  await db.recursiveDelete(db.collection(COLLECTIONS.emailVerifications));
  await seedStudent();
});

describe('sending a code', () => {
  it('stores a hash and never the code itself', async () => {
    await sendVerificationCode.run(asElla({ force: true }));

    const doc = await pending().get();
    const stored = doc.data() as Record<string, unknown>;

    expect(stored.codeHash).toMatch(/^[0-9a-f]{64}$/);
    // Nothing on the document may be six digits — that would be the
    // code sitting in plain sight next to its own hash.
    for (const value of Object.values(stored)) {
      expect(String(value)).not.toMatch(/^\d{6}$/);
    }
  });

  it('expires the code ten minutes out', async () => {
    const result = await sendVerificationCode.run(asElla({ force: true }));
    expect(result.expiresInMinutes).toBe(10);

    const expiresAt = (await pending().get()).get('expiresAt').toMillis();
    const minutes = (expiresAt - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(9);
    expect(minutes).toBeLessThanOrEqual(10);
  });

  it('kills the previous code when a new one is sent', async () => {
    await sendVerificationCode.run(asElla({ force: true }));
    const first = await currentCode();

    await sendVerificationCode.run(asElla({ force: true }));

    const stale = await attempt(confirmVerificationCode, { code: first });
    expect(stale.ok).toBe(false);
    expect((await db.collection(COLLECTIONS.users).doc(UID).get()).get('emailConfirmed')).toBe(
      false,
    );
  });

  it('stops after five codes in an hour', async () => {
    for (let i = 0; i < 5; i += 1) await sendVerificationCode.run(asElla({ force: true }));

    const sixth = await attempt(sendVerificationCode, { force: true });
    expect(sixth.ok).toBe(false);
    expect(sixth.message).toMatch(/too many/i);
  });

  it('refuses somebody who is already confirmed', async () => {
    await seedStudent({ emailConfirmed: true });
    const result = await attempt(sendVerificationCode, { force: true });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already/i);
  });
});

describe('confirming a code', () => {
  it('accepts the right code and marks her confirmed', async () => {
    await sendVerificationCode.run(asElla({ force: true }));
    const code = await currentCode();

    await confirmVerificationCode.run(asElla({ code }));

    const user = (await db.collection(COLLECTIONS.users).doc(UID).get()).data()!;
    expect(user.emailConfirmed).toBe(true);
    expect(user.verificationMethod).toBe('email_confirmed');
    // Spent. Nothing left to replay.
    expect((await pending().get()).exists).toBe(false);
  });

  it('refuses the wrong code without confirming her', async () => {
    await sendVerificationCode.run(asElla({ force: true }));
    const wrong = (await currentCode()) === '000000' ? '111111' : '000000';

    const result = await attempt(confirmVerificationCode, { code: wrong });

    expect(result.ok).toBe(false);
    expect((await db.collection(COLLECTIONS.users).doc(UID).get()).get('emailConfirmed')).toBe(
      false,
    );
  });

  it('refuses an expired code and says so', async () => {
    await sendVerificationCode.run(asElla({ force: true }));
    const code = await currentCode();
    // Reach into the stored document rather than waiting ten minutes.
    await pending().update({ expiresAt: new Date(Date.now() - 1000) });

    const result = await attempt(confirmVerificationCode, { code });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/expired/i);
    // The dead code is cleared, so the next try is a fresh one.
    expect((await pending().get()).exists).toBe(false);
  });

  it('dies after five wrong attempts, even if the sixth is right', async () => {
    await sendVerificationCode.run(asElla({ force: true }));
    const code = await currentCode();
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i += 1) await attempt(confirmVerificationCode, { code: wrong });

    const rightButTooLate = await attempt(confirmVerificationCode, { code });
    expect(rightButTooLate.ok).toBe(false);
    expect(rightButTooLate.message).toMatch(/too many/i);
    expect((await db.collection(COLLECTIONS.users).doc(UID).get()).get('emailConfirmed')).toBe(
      false,
    );
  });

  it('rejects anything that is not six digits before spending an attempt', async () => {
    await sendVerificationCode.run(asElla({ force: true }));

    for (const code of ['', '12345', '1234567', 'abcdef', '12 34 56']) {
      const result = await attempt(confirmVerificationCode, { code });
      expect(result.ok).toBe(false);
    }

    // None of those counted: a typo in the keypad is not a guess.
    expect((await pending().get()).get('attempts')).toBe(0);
  });

  it('refuses when no code was ever asked for', async () => {
    const result = await attempt(confirmVerificationCode, { code: '123456' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/new code/i);
  });
});

describe('opening the code screen', () => {
  it('reuses a code sent moments ago instead of spending another', async () => {
    await sendVerificationCode.run(asElla({ force: true }));
    const first = await currentCode();

    // What the screen does when it opens: asks, without insisting.
    const again = await sendVerificationCode.run(asElla());

    expect(again.sent).toBe(false);
    // The code she already has in her inbox still works, which is the
    // whole point — otherwise the first email is dead on arrival.
    expect(await currentCode()).toBe(first);
    await confirmVerificationCode.run(asElla({ code: first }));
  });

  it('does not count a reuse against her five an hour', async () => {
    await sendVerificationCode.run(asElla({ force: true }));
    for (let i = 0; i < 10; i += 1) await sendVerificationCode.run(asElla());

    // One send used, four left.
    expect((await pending().get()).get('sendsThisHour')).toBe(1);
  });
});
