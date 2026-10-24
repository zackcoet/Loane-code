/**
 * Closing a "Contact us" message from the dashboard, against the emulator.
 *
 *   - Admins only — a student calling it directly is refused.
 *   - A note is required (anything that isn't text counts as none).
 *   - It marks the request resolved, by whom, and writes one audit row
 *     in the same step.
 *   - Resolving twice, a missing request, or junk gets a clear answer.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const ADMIN = 'uid-admin-support';
const STUDENT = 'uid-student-support';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resolve: (req: CallableRequest<any>) => Promise<{ ok: true }>;

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

async function auditRows() {
  return (
    await db
      .collection(COLLECTIONS.adminActions)
      .where('action', '==', 'resolve_support_request')
      .get()
  ).docs.map((d) => d.data());
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../admin/resolveSupportRequest');
  resolve = (req) => mod.resolveSupportRequest.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [COLLECTIONS.supportRequests, COLLECTIONS.adminActions]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.supportRequests}/s1`).set({
    id: 's1',
    requesterUid: STUDENT,
    topic: 'other',
    message: 'Help please',
    status: 'open',
    resolvedAt: null,
    resolvedByUid: null,
  });
});

describe('resolveSupportRequest', () => {
  it('marks it resolved, by whom, with one audit row', async () => {
    await resolve(as(ADMIN, { requestId: 's1', notes: '  Replied by email  ' }));
    const data = (await db.doc(`${COLLECTIONS.supportRequests}/s1`).get()).data();
    expect(data?.status).toBe('resolved');
    expect(data?.resolvedByUid).toBe(ADMIN);
    expect(data?.resolvedAt).toBeTruthy();

    const rows = await auditRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      adminUid: ADMIN,
      targetId: 's1',
      notes: 'Replied by email',
      before: { status: 'open' },
      after: { status: 'resolved' },
    });
  });

  it('refuses a student calling it directly', async () => {
    expect(
      await attempt(() => resolve(as(STUDENT, { requestId: 's1', notes: 'x' }, false))),
    ).toMatch(/Admins only/);
    const data = (await db.doc(`${COLLECTIONS.supportRequests}/s1`).get()).data();
    expect(data?.status).toBe('open');
    expect(await auditRows()).toHaveLength(0);
  });

  it('needs a note, and treats a note that is not text as none', async () => {
    expect(await attempt(() => resolve(as(ADMIN, { requestId: 's1', notes: '   ' })))).toMatch(
      /Add a note/,
    );
    expect(await attempt(() => resolve(as(ADMIN, { requestId: 's1', notes: 42 })))).toMatch(
      /Add a note/,
    );
    expect(
      await attempt(() => resolve(as(ADMIN, { requestId: 's1', notes: 'x'.repeat(1001) }))),
    ).toMatch(/too long/);
    expect(await auditRows()).toHaveLength(0);
  });

  it('refuses resolving twice, a missing request and junk', async () => {
    await resolve(as(ADMIN, { requestId: 's1', notes: 'Done' }));
    expect(await attempt(() => resolve(as(ADMIN, { requestId: 's1', notes: 'Again' })))).toMatch(
      /already resolved/,
    );
    expect(await attempt(() => resolve(as(ADMIN, { requestId: 's-x', notes: 'Done' })))).toMatch(
      /could not find/,
    );
    expect(await attempt(() => resolve(as(ADMIN, { requestId: { a: 1 }, notes: 'Done' })))).toMatch(
      /could not find/,
    );
    expect(await auditRows()).toHaveLength(1);
  });
});
