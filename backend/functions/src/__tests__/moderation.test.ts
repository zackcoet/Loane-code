/**
 * The dashboard's take-down and suspend buttons, against the emulator.
 *
 *   - Admins only; junk input gets a clear answer.
 *   - Taking a piece down remembers what it was, and putting it back
 *     returns it there — a sold piece comes back sold, not rentable.
 *   - Something its owner already removed can't be taken down (and so
 *     can't be "put back" to life).
 *   - A comment's count under the look moves once, even if two admins act.
 *   - Suspending: never yourself, never an admin, never a deleted account.
 *   - Lifting a suspension only works on a suspended account — it used
 *     to turn a deleted account back into a live one.
 *   - Every action writes one audit row and one notice to her.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const ADMIN = 'uid-admin-mod';
const OTHER_ADMIN = 'uid-admin-mod-2';
const OWNER = 'uid-owner-mod';
const COMMENTER = 'uid-commenter-mod';

type Fn = (req: CallableRequest<unknown>) => Promise<unknown>;

let app: App;
let db: Firestore;
const NAMES = [
  'hideListing',
  'restoreListing',
  'hidePost',
  'restorePost',
  'hideComment',
  'restoreComment',
  'suspendUser',
  'unsuspendUser',
  'addAdminNote',
] as const;
const fns = {} as Record<(typeof NAMES)[number], Fn>;

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

async function auditRows(action: string) {
  return (await db.collection(COLLECTIONS.adminActions).where('action', '==', action).get()).docs;
}

async function notices(uid: string) {
  return (await db.collection(`${COLLECTIONS.users}/${uid}/notifications`).get()).docs.map((d) =>
    d.data(),
  );
}

function user(uid: string, extra: Record<string, unknown> = {}) {
  return {
    uid,
    username: uid.replace(/[^a-z]/g, ''),
    displayName: uid,
    role: 'student',
    status: 'active',
    suspendedReason: null,
    suspendedUntil: null,
    ...extra,
  };
}

async function listing(status: string) {
  await db.doc(`${COLLECTIONS.listings}/l1`).set({
    id: 'l1',
    ownerUid: OWNER,
    status,
    suspendedReason: null,
  });
}

async function post(status: string) {
  await db.doc(`${COLLECTIONS.posts}/p1`).set({
    id: 'p1',
    authorUid: OWNER,
    status,
    suspendedReason: null,
    stats: { commentCount: 3 },
  });
}

async function listingStatus() {
  return (await db.doc(`${COLLECTIONS.listings}/l1`).get()).data()?.status;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);

  const mods = {
    ...(await import('../admin/moderateContent')),
    ...(await import('../admin/moderateUsers')),
  } as unknown as Record<string, { run: Fn }>;
  for (const name of NAMES) {
    const runnable = mods[name];
    if (!runnable) throw new Error(`Missing function ${name}`);
    fns[name] = (req) => runnable.run(req);
  }
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.listings,
    COLLECTIONS.posts,
    COLLECTIONS.comments,
    COLLECTIONS.users,
    COLLECTIONS.adminActions,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${ADMIN}`).set(user(ADMIN, { role: 'admin' }));
  await db.doc(`${COLLECTIONS.users}/${OTHER_ADMIN}`).set(user(OTHER_ADMIN, { role: 'admin' }));
  await db.doc(`${COLLECTIONS.users}/${OWNER}`).set(user(OWNER));
  await db.doc(`${COLLECTIONS.users}/${COMMENTER}`).set(user(COMMENTER));
});

describe('taking a piece down and putting it back', () => {
  it('takes an active piece down, then brings it back active, with audit rows and notices', async () => {
    await listing('active');
    await fns.hideListing(as(ADMIN, { id: 'l1', reason: '  Not a real photo ' }));

    const down = (await db.doc(`${COLLECTIONS.listings}/l1`).get()).data();
    expect(down).toMatchObject({
      status: 'suspended',
      suspendedReason: 'Not a real photo',
      statusBeforeSuspension: 'active',
    });

    await fns.restoreListing(as(ADMIN, { id: 'l1', reason: 'Owner sent a real one' }));
    const up = (await db.doc(`${COLLECTIONS.listings}/l1`).get()).data();
    expect(up).toMatchObject({
      status: 'active',
      suspendedReason: null,
      statusBeforeSuspension: null,
    });

    expect(await auditRows('hide_listing')).toHaveLength(1);
    expect(await auditRows('restore_listing')).toHaveLength(1);
    const titles = (await notices(OWNER)).map((n) => n.title).sort();
    expect(titles).toEqual(['Your listing is back up', 'Your listing was taken down']);
  });

  it('brings a sold piece back sold, and a paused one paused — never rentable by accident', async () => {
    await listing('sold');
    await fns.hideListing(as(ADMIN, { id: 'l1', reason: 'Reported' }));
    await fns.restoreListing(as(ADMIN, { id: 'l1', reason: 'Fine after all' }));
    expect(await listingStatus()).toBe('sold');

    await listing('paused');
    await fns.hideListing(as(ADMIN, { id: 'l1', reason: 'Reported' }));
    await fns.restoreListing(as(ADMIN, { id: 'l1', reason: 'Fine after all' }));
    expect(await listingStatus()).toBe('paused');
  });

  it('brings back as active a piece taken down before it remembered anything', async () => {
    await db.doc(`${COLLECTIONS.listings}/l1`).set({
      id: 'l1',
      ownerUid: OWNER,
      status: 'suspended',
      suspendedReason: 'Old takedown',
    });
    await fns.restoreListing(as(ADMIN, { id: 'l1', reason: 'Fine' }));
    expect(await listingStatus()).toBe('active');
  });

  it('refuses taking down something its owner already removed, or that is already down', async () => {
    await listing('removed');
    expect(await attempt(() => fns.hideListing(as(ADMIN, { id: 'l1', reason: 'x' })))).toMatch(
      /owner already removed/,
    );
    expect(await listingStatus()).toBe('removed');

    await listing('active');
    await fns.hideListing(as(ADMIN, { id: 'l1', reason: 'x' }));
    expect(await attempt(() => fns.hideListing(as(ADMIN, { id: 'l1', reason: 'y' })))).toMatch(
      /already down/,
    );
    expect(await auditRows('hide_listing')).toHaveLength(1);
  });

  it('refuses putting back something that is not down', async () => {
    await listing('active');
    expect(await attempt(() => fns.restoreListing(as(ADMIN, { id: 'l1', reason: 'x' })))).toMatch(
      /not suspended/,
    );
  });

  it('brings a scheduled look back scheduled', async () => {
    await post('scheduled');
    await fns.hidePost(as(ADMIN, { id: 'p1', reason: 'Reported' }));
    expect((await db.doc(`${COLLECTIONS.posts}/p1`).get()).data()?.status).toBe('suspended');
    await fns.restorePost(as(ADMIN, { id: 'p1', reason: 'Fine' }));
    expect((await db.doc(`${COLLECTIONS.posts}/p1`).get()).data()?.status).toBe('scheduled');
  });

  it('refuses a student, a missing piece, and junk', async () => {
    await listing('active');
    expect(
      await attempt(() => fns.hideListing(as(OWNER, { id: 'l1', reason: 'x' }, false))),
    ).toMatch(/Admins only/);
    expect(await attempt(() => fns.hideListing(as(ADMIN, { id: 'nope', reason: 'x' })))).toMatch(
      /could not find/,
    );
    for (const id of [{ a: 1 }, 42, '', 'a/b']) {
      expect(await attempt(() => fns.hideListing(as(ADMIN, { id, reason: 'x' })))).toMatch(
        /Which listing/,
      );
    }
    expect(await attempt(() => fns.hideListing(as(ADMIN, { id: 'l1', reason: 7 })))).toMatch(
      /Say why/,
    );
    expect(await listingStatus()).toBe('active');
    expect(await auditRows('hide_listing')).toHaveLength(0);
  });
});

describe('taking a comment down', () => {
  beforeEach(async () => {
    await post('active');
    await db.doc(`${COLLECTIONS.comments}/c1`).set({
      id: 'c1',
      postId: 'p1',
      authorUid: COMMENTER,
      status: 'active',
      suspendedReason: null,
    });
  });

  async function commentCount() {
    return (await db.doc(`${COLLECTIONS.posts}/p1`).get()).data()?.stats.commentCount;
  }

  it('moves the count under the look down and back up', async () => {
    await fns.hideComment(as(ADMIN, { id: 'c1', reason: 'Rude' }));
    expect(await commentCount()).toBe(2);
    await fns.restoreComment(as(ADMIN, { id: 'c1', reason: 'Context' }));
    expect(await commentCount()).toBe(3);
    expect((await notices(COMMENTER)).length).toBe(2);
  });

  it('moves the count only once when two admins act at the same moment', async () => {
    const results = await Promise.all([
      attempt(() => fns.hideComment(as(ADMIN, { id: 'c1', reason: 'Rude' }))),
      attempt(() => fns.hideComment(as(OTHER_ADMIN, { id: 'c1', reason: 'Rude' }))),
    ]);
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(await commentCount()).toBe(2);
    expect(await auditRows('hide_comment')).toHaveLength(1);
    expect((await notices(COMMENTER)).length).toBe(1);
  });

  it('gives junk a clear answer', async () => {
    expect(await attempt(() => fns.hideComment(as(ADMIN, { id: ['c1'], reason: 'x' })))).toMatch(
      /Which comment/,
    );
    expect(await commentCount()).toBe(3);
  });
});

describe('suspending a student', () => {
  async function ownerData() {
    return (await db.doc(`${COLLECTIONS.users}/${OWNER}`).get()).data();
  }

  it('suspends her, tells her, and lifts it again', async () => {
    await fns.suspendUser(as(ADMIN, { uid: OWNER, reason: 'Off-app payments' }));
    expect(await ownerData()).toMatchObject({
      status: 'suspended',
      suspendedReason: 'Off-app payments',
      suspendedUntil: null,
    });

    await fns.unsuspendUser(as(ADMIN, { uid: OWNER, reason: 'Appeal accepted' }));
    expect(await ownerData()).toMatchObject({ status: 'active', suspendedReason: null });

    expect(await auditRows('suspend_user')).toHaveLength(1);
    expect(await auditRows('unsuspend_user')).toHaveLength(1);
    const titles = (await notices(OWNER)).map((n) => n.title).sort();
    expect(titles).toEqual(['Your account is active again', 'Your account is suspended']);
  });

  it('keeps a valid end date, and refuses a bad or past one without crashing', async () => {
    for (const until of ['next week', '2026-13-45', '2020-01-01', 12]) {
      expect(
        await attempt(() => fns.suspendUser(as(ADMIN, { uid: OWNER, reason: 'x', until }))),
      ).toMatch(/end date/);
    }
    expect((await ownerData())?.status).toBe('active');

    await fns.suspendUser(as(ADMIN, { uid: OWNER, reason: 'x', until: '2099-01-01' }));
    const data = await ownerData();
    expect(data?.status).toBe('suspended');
    expect(data?.suspendedUntil?.toDate().toISOString()).toBe('2099-01-01T00:00:00.000Z');
  });

  it('never suspends yourself, another admin, or someone already suspended', async () => {
    expect(await attempt(() => fns.suspendUser(as(ADMIN, { uid: ADMIN, reason: 'x' })))).toMatch(
      /suspend yourself/,
    );
    expect(
      await attempt(() => fns.suspendUser(as(ADMIN, { uid: OTHER_ADMIN, reason: 'x' }))),
    ).toMatch(/Admins cannot/);
    await fns.suspendUser(as(ADMIN, { uid: OWNER, reason: 'x' }));
    expect(await attempt(() => fns.suspendUser(as(ADMIN, { uid: OWNER, reason: 'y' })))).toMatch(
      /already suspended/,
    );
    expect(await auditRows('suspend_user')).toHaveLength(1);
  });

  it('never suspends a deleted account, and never brings one back to life', async () => {
    await db.doc(`${COLLECTIONS.users}/${OWNER}`).update({ status: 'deactivated' });
    expect(await attempt(() => fns.suspendUser(as(ADMIN, { uid: OWNER, reason: 'x' })))).toMatch(
      /account is deleted/,
    );
    expect(await attempt(() => fns.unsuspendUser(as(ADMIN, { uid: OWNER, reason: 'x' })))).toMatch(
      /account is deleted/,
    );
    expect((await ownerData())?.status).toBe('deactivated');
    expect(await notices(OWNER)).toHaveLength(0);
  });

  it('refuses lifting a suspension she does not have', async () => {
    expect(await attempt(() => fns.unsuspendUser(as(ADMIN, { uid: OWNER, reason: 'x' })))).toMatch(
      /not suspended/,
    );
    expect(await notices(OWNER)).toHaveLength(0);
  });

  it('refuses a student, a missing account, and junk', async () => {
    expect(
      await attempt(() => fns.suspendUser(as(COMMENTER, { uid: OWNER, reason: 'x' }, false))),
    ).toMatch(/Admins only/);
    expect(await attempt(() => fns.suspendUser(as(ADMIN, { uid: 'ghost', reason: 'x' })))).toMatch(
      /could not find/,
    );
    for (const uid of [{ a: 1 }, 5, '', 'a/b']) {
      expect(await attempt(() => fns.suspendUser(as(ADMIN, { uid, reason: 'x' })))).toMatch(
        /Which student/,
      );
      expect(await attempt(() => fns.addAdminNote(as(ADMIN, { uid, note: 'x' })))).toMatch(
        /Which student/,
      );
    }
    expect((await ownerData())?.status).toBe('active');
  });
});
