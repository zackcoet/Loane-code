/**
 * Publishing Terms and Privacy from the dashboard, and a student
 * accepting them, against the emulator.
 *
 *   - Drafts and publishing are admins only; junk gets a clear answer.
 *   - The effective date must be a real day, not just the right shape.
 *   - Saving a draft again keeps when it was started.
 *   - Publishing numbers versions 1, 2, 3…, clears the draft and writes
 *     one audit row. Two admins publishing at once: one wins, the other
 *     is told — never two new versions back to back.
 *   - Accepting only works for the versions that are live right now,
 *     sent as real numbers, on an account that still exists.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const ADMIN = 'uid-admin-legal';
const STUDENT = 'uid-student-legal';
const TEXT = 'These are the terms. '.repeat(10);

type Fn = (req: CallableRequest<unknown>) => Promise<unknown>;

let app: App;
let db: Firestore;
let saveDraft: Fn;
let publish: Fn;
let accept: Fn;

function as(uid: string, data: unknown, admin = true): CallableRequest<unknown> {
  return {
    auth: { uid, token: { admin, email: 'admin@joinloane.com' } },
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

function input(extra: Record<string, unknown> = {}) {
  return {
    kind: 'terms',
    text: TEXT,
    effectiveDate: '2026-11-01',
    significantChange: true,
    ...extra,
  };
}

async function versions(kind: string) {
  return (await db.collection(COLLECTIONS.legalDocs).where('kind', '==', kind).get()).docs
    .map((d) => d.data().version as number)
    .sort();
}

async function publishRows() {
  return (
    await db.collection(COLLECTIONS.adminActions).where('action', '==', 'publish_legal_doc').get()
  ).docs;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../legal/legal');
  saveDraft = (req) => mod.saveLegalDraft.run(req as never);
  publish = (req) => mod.publishLegalDoc.run(req as never);
  accept = (req) => mod.acceptLegalDocs.run(req as never);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.legalDocs,
    COLLECTIONS.legalDrafts,
    COLLECTIONS.adminActions,
    COLLECTIONS.users,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${STUDENT}`).set({
    uid: STUDENT,
    role: 'student',
    status: 'active',
    legalAccepted: { termsVersion: null, privacyVersion: null },
  });
});

describe('legal drafts', () => {
  it('saves a draft with the next version number, and keeps when it was started', async () => {
    expect(await saveDraft(as(ADMIN, input()))).toEqual({ ok: true, nextVersion: 1 });
    const first = (await db.doc(`${COLLECTIONS.legalDrafts}/terms`).get()).data();

    await new Promise((r) => setTimeout(r, 20));
    await saveDraft(as(ADMIN, input({ text: `${TEXT} More.` })));
    const second = (await db.doc(`${COLLECTIONS.legalDrafts}/terms`).get()).data();

    expect(second?.text).toBe(`${TEXT} More.`.trim());
    expect(second?.createdAt.toMillis()).toBe(first?.createdAt.toMillis());
    expect(second?.updatedAt.toMillis()).toBeGreaterThan(first?.updatedAt.toMillis());
  });

  it('refuses a student, a made-up date, short text and junk without crashing', async () => {
    expect(await attempt(() => saveDraft(as(STUDENT, input(), false)))).toMatch(/Admins only/);
    for (const effectiveDate of ['2026-13-45', '2026-02-30', 'next week', 20261101, null]) {
      expect(await attempt(() => saveDraft(as(ADMIN, input({ effectiveDate }))))).toMatch(
        /effective date/,
      );
      expect(await attempt(() => publish(as(ADMIN, input({ effectiveDate }))))).toMatch(
        /effective date/,
      );
    }
    expect(await attempt(() => saveDraft(as(ADMIN, input({ text: 'short' }))))).toMatch(
      /too short/,
    );
    expect(await attempt(() => saveDraft(as(ADMIN, input({ kind: 'cookies' }))))).toMatch(
      /Terms or Privacy/,
    );
    expect(await attempt(() => saveDraft(as(ADMIN, null)))).toMatch(/Terms or Privacy/);
    expect((await db.collection(COLLECTIONS.legalDrafts).get()).size).toBe(0);
  });
});

describe('publishing legal documents', () => {
  it('numbers versions in order, clears the draft and writes one audit row each', async () => {
    await saveDraft(as(ADMIN, input()));
    expect(await publish(as(ADMIN, input()))).toEqual({ id: 'terms_v1', version: 1 });
    expect((await db.doc(`${COLLECTIONS.legalDrafts}/terms`).get()).exists).toBe(false);

    expect(await publish(as(ADMIN, input()))).toEqual({ id: 'terms_v2', version: 2 });
    expect(await publish(as(ADMIN, input({ kind: 'privacy' })))).toEqual({
      id: 'privacy_v1',
      version: 1,
    });

    expect(await versions('terms')).toEqual([1, 2]);
    expect(await publishRows()).toHaveLength(3);
  });

  it('publishes only one new version when two admins press Publish at once', async () => {
    await publish(as(ADMIN, input()));
    const results = await Promise.all([
      attempt(() => publish(as(ADMIN, input({ text: `${TEXT} From Zack.` })))),
      attempt(() => publish(as('uid-admin-legal-2', input({ text: `${TEXT} From Ella.` })))),
    ]);

    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(results.find((r) => r !== 'ok')).toMatch(/Someone just published/);
    expect(await versions('terms')).toEqual([1, 2]);
    expect(await publishRows()).toHaveLength(2);
  });

  it('refuses a student', async () => {
    expect(await attempt(() => publish(as(STUDENT, input(), false)))).toMatch(/Admins only/);
    expect(await versions('terms')).toEqual([]);
  });
});

describe('accepting legal documents', () => {
  beforeEach(async () => {
    await publish(as(ADMIN, input()));
    await publish(as(ADMIN, input()));
    await publish(as(ADMIN, input({ kind: 'privacy' })));
  });

  async function accepted() {
    return (await db.doc(`${COLLECTIONS.users}/${STUDENT}`).get()).data()?.legalAccepted;
  }

  it('records the live versions and when she agreed', async () => {
    await accept(as(STUDENT, { termsVersion: 2, privacyVersion: 1 }, false));
    const legal = await accepted();
    expect(legal).toMatchObject({ termsVersion: 2, privacyVersion: 1 });
    expect(legal?.termsAcceptedAt).toBeTruthy();
    expect(legal?.privacyAcceptedAt).toBeTruthy();
  });

  it('refuses an old version, so she must read the new one first', async () => {
    expect(
      await attempt(() => accept(as(STUDENT, { termsVersion: 1, privacyVersion: 1 }, false))),
    ).toMatch(/changed/);
    expect((await accepted())?.termsVersion).toBeNull();
  });

  it('refuses versions that are not plain numbers', async () => {
    for (const data of [
      { termsVersion: '2', privacyVersion: '1' },
      { termsVersion: true, privacyVersion: true },
      { termsVersion: 2 },
      null,
    ]) {
      expect(await attempt(() => accept(as(STUDENT, data, false)))).toMatch(/Review the latest/);
    }
    expect((await accepted())?.termsVersion).toBeNull();
  });

  it('gives a missing or deleted account a clear answer', async () => {
    expect(
      await attempt(() => accept(as('uid-ghost', { termsVersion: 2, privacyVersion: 1 }, false))),
    ).toMatch(/could not find your account/);

    await db.doc(`${COLLECTIONS.users}/${STUDENT}`).update({ status: 'deactivated' });
    expect(
      await attempt(() => accept(as(STUDENT, { termsVersion: 2, privacyVersion: 1 }, false))),
    ).toMatch(/could not find your account/);
    expect((await accepted())?.termsVersion).toBeNull();
  });

  it('asks her to sign in first', async () => {
    const req = { data: { termsVersion: 2, privacyVersion: 1 } } as CallableRequest<unknown>;
    expect(await attempt(() => accept(req))).toMatch(/Sign in/);
  });
});
