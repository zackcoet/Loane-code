/**
 * The "is this username free?" hint on sign-up and Edit profile,
 * against the emulator.
 *
 *   - A free name is free; a taken one is taken, whatever its case or
 *     spacing.
 *   - Names the rules forbid (too short, bad characters, reserved, the
 *     deleted_ shells) are refused with the form's own words.
 *   - Junk input gets a clear answer, not a crash.
 *   - It works before she has an account — sign-up asks before one exists.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';

type Result = { available: boolean; reason?: string };

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let checkUsername: (req: CallableRequest<any>) => Promise<Result>;

/** Nobody signed in — the sign-up screen asks before an account exists. */
function check(data: unknown): Promise<Result> {
  return checkUsername({ data } as unknown as CallableRequest<unknown>);
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../auth/checkUsername');
  checkUsername = (req) => mod.checkUsername.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection(COLLECTIONS.usernames));
  await db.doc(`${COLLECTIONS.usernames}/ella.p`).set({ uid: 'uid-ella' });
});

describe('checkUsername', () => {
  it('says a free name is free, without anyone signed in', async () => {
    expect(await check({ username: 'anna.k' })).toEqual({ available: true });
  });

  it('says a taken name is taken, whatever the case or spacing', async () => {
    for (const username of ['ella.p', 'Ella.P', '  ella.p  ']) {
      const result = await check({ username });
      expect(result.available).toBe(false);
      expect(result.reason).toBe('That username is taken. Try another.');
    }
  });

  it('refuses names the rules forbid, in the form’s own words', async () => {
    expect((await check({ username: 'ab' })).reason).toMatch(/at least/);
    expect((await check({ username: 'ella p' })).reason).toMatch(/letters, numbers/);
    expect((await check({ username: '.ella' })).reason).toMatch(/start or end/);
    expect((await check({ username: 'admin' })).reason).toBe('That username is reserved.');
    expect((await check({ username: 'deleted_abc123' })).reason).toBe('That username is reserved.');
  });

  it('gives junk a clear answer, not a crash', async () => {
    for (const data of [undefined, null, {}, { username: 42 }, { username: ['ella.p'] }]) {
      const result = await check(data);
      expect(result.available).toBe(false);
      expect(result.reason).toMatch(/at least/);
    }
  });
});
