/**
 * The switchboard: setFeatureFlag, and the features it switches.
 *
 *   - Only an admin can flip a switch, and she must say why.
 *   - Payments and email codes cannot be turned on yet; anything can be
 *     turned off.
 *   - Every flip leaves an audit row with before and after.
 *   - The old try-on switch writes the same document.
 *   - Try-on, email codes and same-day actually obey the switch.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, FEATURE_FLAGS_DOC } from '@loane/shared';

const PROJECT = 'demo-loane';
const ADMIN = 'uid-admin-flags';
const STUDENT = 'uid-student-flags';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let setFeatureFlag: (req: CallableRequest<any>) => Promise<unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let setTryOnConfig: (req: CallableRequest<any>) => Promise<unknown>;
let flagsMod: typeof import('../lib/featureFlags');
let tryOnConfig: typeof import('../tryon/config');

function as(uid: string, admin: boolean, data: unknown): CallableRequest<unknown> {
  return {
    auth: { uid, token: { admin, email: `${uid}@example.test` } },
    data,
  } as unknown as CallableRequest<unknown>;
}

async function attempt(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'ok';
  } catch (error) {
    return (error as { message?: string }).message ?? 'error';
  }
}

const featuresDoc = () => db.collection(COLLECTIONS.config).doc(FEATURE_FLAGS_DOC);

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const admin = await import('../admin/featureFlags');
  const tryOnAdmin = await import('../tryon/admin');
  flagsMod = await import('../lib/featureFlags');
  tryOnConfig = await import('../tryon/config');
  setFeatureFlag = (req) => admin.setFeatureFlag.run(req);
  setTryOnConfig = (req) => tryOnAdmin.setTryOnConfig.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await featuresDoc().delete();
  await db.recursiveDelete(db.collection(COLLECTIONS.adminActions));
});

describe('defaults', () => {
  it('with no document, everything risky is off and same-day is on', async () => {
    const flags = await flagsMod.getFeatureFlags();
    expect(flags).toEqual({
      tryOn: false,
      tryOnAdminPreview: false,
      emailVerification: false,
      sameDay: true,
      payments: false,
    });
    expect(await tryOnConfig.verificationRequired()).toBe(false);
  });
});

describe('setFeatureFlag', () => {
  it('refuses a student', async () => {
    const result = await attempt(() =>
      setFeatureFlag(as(STUDENT, false, { flag: 'sameDay', value: false, reason: 'x' })),
    );
    expect(result).toMatch(/Admins only/);
    expect((await featuresDoc().get()).exists).toBe(false);
  });

  it('needs a reason and a real switch', async () => {
    expect(
      await attempt(() => setFeatureFlag(as(ADMIN, true, { flag: 'sameDay', value: false }))),
    ).toMatch(/Why/);
    expect(
      await attempt(() =>
        setFeatureFlag(as(ADMIN, true, { flag: 'admin', value: true, reason: 'x' })),
      ),
    ).toMatch(/Which switch/);
    expect(
      await attempt(() =>
        setFeatureFlag(as(ADMIN, true, { flag: 'sameDay', value: 'no', reason: 'x' })),
      ),
    ).toMatch(/On or off/);
  });

  it('will not turn on payments or email codes yet', async () => {
    expect(
      await attempt(() =>
        setFeatureFlag(as(ADMIN, true, { flag: 'payments', value: true, reason: 'launch' })),
      ),
    ).toMatch(/can't be turned on yet/);
    expect(
      await attempt(() =>
        setFeatureFlag(
          as(ADMIN, true, { flag: 'emailVerification', value: true, reason: 'launch' }),
        ),
      ),
    ).toMatch(/can't be turned on yet/);
    expect((await flagsMod.getFeatureFlags()).payments).toBe(false);
  });

  it('turns same-day off, with an audit row saying before and after', async () => {
    await setFeatureFlag(as(ADMIN, true, { flag: 'sameDay', value: false, reason: 'rush week' }));

    expect((await flagsMod.getFeatureFlags()).sameDay).toBe(false);
    const audit = await db.collection(COLLECTIONS.adminActions).get();
    expect(audit.size).toBe(1);
    const row = audit.docs[0]!.data();
    expect(row.action).toBe('feature_flag_changed');
    expect(row.notes).toBe('rush week');
    expect(row.before).toEqual({ sameDay: true });
    expect(row.after).toEqual({ sameDay: false });

    // Same-day requests are now refused before anything else is checked.
    await expect(
      flagsMod.assertFeatureOn('sameDay', 'Same-day pickup is paused right now.'),
    ).rejects.toThrow(/paused/);
  });

  it('the old try-on switch writes the same switchboard', async () => {
    await setTryOnConfig(as(ADMIN, true, { enabledForAdmins: true, reason: 'dry run' }));
    const flags = await flagsMod.getFeatureFlags();
    expect(flags.tryOnAdminPreview).toBe(true);
    expect(flags.tryOn).toBe(false);

    // An admin gets through; a student is told it is off for students.
    await expect(
      tryOnConfig.assertTryOnEnabled(as(ADMIN, true, {}) as CallableRequest),
    ).resolves.toBeUndefined();
    await expect(
      tryOnConfig.assertTryOnEnabled(as(STUDENT, false, {}) as CallableRequest),
    ).rejects.toThrow(/off for students/);
  });
});
