/**
 * Acting on a report — taking down a reported review or message.
 *
 *   - A review comes down and her rating is worked out again without it.
 *   - A message is wiped for both people, the inbox preview follows,
 *     and the original words survive only in the admin audit row.
 *   - Only an admin can do either.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, REMOVED_MESSAGE_TEXT } from '@loane/shared';

const PROJECT = 'demo-loane';
const ADMIN = 'uid-admin-resolve';
const ELLA = 'uid-ella-resolve';
const MADDIE = 'uid-maddie-resolve';
const CONVO = 'convo-resolve';

interface Input {
  reportId: string;
  status: 'reviewing' | 'actioned' | 'dismissed';
  action?: 'none' | 'content_removed' | 'user_warned' | 'user_suspended';
  notes: string;
}

let app: App;
let db: Firestore;
let run: (req: CallableRequest<Input>) => Promise<{ ok: true }>;

function asAdmin(data: Input, admin = true): CallableRequest<Input> {
  return {
    auth: { uid: ADMIN, token: { admin, email: 'admin@joinloane.com' } },
    data,
  } as unknown as CallableRequest<Input>;
}

async function attempt(req: CallableRequest<Input>): Promise<string> {
  try {
    await run(req);
    return 'ok';
  } catch (error) {
    return (error as { message?: string }).message ?? 'error';
  }
}

function report(targetType: string, targetId: string, targetUid: string) {
  return {
    reporterUid: ELLA,
    targetType,
    targetId,
    targetUid,
    reason: 'harassment',
    details: '',
    photos: [],
    status: 'open',
    campusId: 'university-of-south-carolina',
    resolution: { adminUid: null, action: null, notes: null, resolvedAt: null },
  };
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT }, 'resolve-report-test');
  db = getFirestore(app);
  const mod = await import('../admin/resolveReport');
  run = (req) => mod.resolveReport.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const id of ['rev-1', 'rev-2', 'rev-3']) await db.doc(`reviews/${id}`).delete();
  for (const id of ['rep-review', 'rep-message']) await db.doc(`reports/${id}`).delete();
  await db.recursiveDelete(db.doc(`${COLLECTIONS.conversations}/${CONVO}`));

  await db.doc(`users/${ELLA}`).set({
    uid: ELLA,
    status: 'active',
    role: 'student',
    stats: { ratingCount: 2, ratingAverage: 3 },
  });
  await db.doc(`users/${MADDIE}`).set({ uid: MADDIE, status: 'active', role: 'student' });

  // Two reviews of Ella: a fair five, and a spiteful one-star from Maddie.
  await db
    .doc('reviews/rev-1')
    .set({ authorUid: 'uid-x', subjectUid: ELLA, rating: 5, isHidden: false });
  await db
    .doc('reviews/rev-2')
    .set({ authorUid: MADDIE, subjectUid: ELLA, rating: 1, isHidden: false });
  await db.doc('reports/rep-review').set(report('review', 'rev-2', MADDIE));

  // A chat where Maddie's last message is the one reported.
  await db.doc(`conversations/${CONVO}`).set({
    participantUids: [ELLA, MADDIE],
    lastMessage: { body: 'awful words', senderUid: MADDIE, sentAt: new Date() },
  });
  await db.doc(`conversations/${CONVO}/messages/m1`).set({
    conversationId: CONVO,
    senderUid: MADDIE,
    body: 'awful words',
    photo: null,
    sharedPost: null,
    sharedListing: null,
    readBy: [],
    likedBy: [ELLA],
    isDeleted: false,
  });
  await db.doc('reports/rep-message').set(report('message', `${CONVO}/m1`, MADDIE));
});

describe('resolveReport — take the content down', () => {
  it('only an admin can do it', async () => {
    const out = await attempt(
      asAdmin(
        { reportId: 'rep-review', status: 'actioned', action: 'content_removed', notes: 'x' },
        false,
      ),
    );
    expect(out).toMatch(/Admins only/);
    expect((await db.doc('reviews/rev-2').get()).data()?.isHidden).toBe(false);
  });

  it('hides a reported review and recomputes her rating', async () => {
    expect(
      await attempt(
        asAdmin({
          reportId: 'rep-review',
          status: 'actioned',
          action: 'content_removed',
          notes: 'Retaliation review',
        }),
      ),
    ).toBe('ok');

    expect((await db.doc('reviews/rev-2').get()).data()?.isHidden).toBe(true);
    const stats = (await db.doc(`users/${ELLA}`).get()).data()?.stats;
    expect(stats).toMatchObject({ ratingCount: 1, ratingAverage: 5 });
    expect((await db.doc('reports/rep-review').get()).data()?.status).toBe('actioned');

    const audit = await db
      .collection(COLLECTIONS.adminActions)
      .where('targetId', '==', 'rev-2')
      .where('action', '==', 'hide_review')
      .get();
    expect(audit.size).toBe(1);
  });

  it('wipes a reported message for both people and replaces the inbox preview', async () => {
    expect(
      await attempt(
        asAdmin({
          reportId: 'rep-message',
          status: 'actioned',
          action: 'content_removed',
          notes: 'Threat',
        }),
      ),
    ).toBe('ok');

    const message = (await db.doc(`conversations/${CONVO}/messages/m1`).get()).data();
    expect(message).toMatchObject({ isDeleted: true, body: '', photo: null, likedBy: [] });

    const convo = (await db.doc(`conversations/${CONVO}`).get()).data();
    expect(convo?.lastMessage.body).toBe(REMOVED_MESSAGE_TEXT);
    // A take-down is not a new message: the chat keeps its place in the inbox.
    expect(convo?.updatedAt).toBeUndefined();

    // The words live on only where admins can see them.
    const audit = await db
      .collection(COLLECTIONS.adminActions)
      .where('targetId', '==', `${CONVO}/m1`)
      .where('action', '==', 'hide_message')
      .get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0]!.data().before.body).toBe('awful words');
  });

  it('leaves the inbox preview alone when someone has written since', async () => {
    await db.doc(`conversations/${CONVO}`).update({
      lastMessage: { body: 'reported you', senderUid: ELLA, sentAt: new Date() },
    });
    await run(
      asAdmin({
        reportId: 'rep-message',
        status: 'actioned',
        action: 'content_removed',
        notes: 'x',
      }),
    );
    const convo = (await db.doc(`conversations/${CONVO}`).get()).data();
    expect(convo?.lastMessage.body).toBe('reported you');
  });
});

describe('resolveReport — pieces, looks and accounts', () => {
  beforeEach(async () => {
    for (const id of ['rep-listing', 'rep-user']) await db.doc(`reports/${id}`).delete();
    await db.doc('listings/l-rep').set({ id: 'l-rep', ownerUid: MADDIE, status: 'sold' });
    await db.doc('reports/rep-listing').set(report('listing', 'l-rep', MADDIE));
    await db.doc('reports/rep-user').set(report('user', MADDIE, MADDIE));
  });

  it('takes a sold piece down and remembers it was sold', async () => {
    await run(
      asAdmin({
        reportId: 'rep-listing',
        status: 'actioned',
        action: 'content_removed',
        notes: 'x',
      }),
    );
    const data = (await db.doc('listings/l-rep').get()).data();
    expect(data).toMatchObject({ status: 'suspended', statusBeforeSuspension: 'sold' });
  });

  it('closes the report but leaves alone a piece its owner already removed', async () => {
    await db.doc('listings/l-rep').update({ status: 'removed' });
    await run(
      asAdmin({
        reportId: 'rep-listing',
        status: 'actioned',
        action: 'content_removed',
        notes: 'x',
      }),
    );
    expect((await db.doc('listings/l-rep').get()).data()?.status).toBe('removed');
    expect((await db.doc('reports/rep-listing').get()).data()?.status).toBe('actioned');
  });

  it('refuses suspending or warning a deleted account, and leaves it deleted', async () => {
    await db.doc(`users/${MADDIE}`).update({ status: 'deactivated' });
    for (const action of ['user_suspended', 'user_warned'] as const) {
      expect(
        await attempt(asAdmin({ reportId: 'rep-user', status: 'actioned', action, notes: 'x' })),
      ).toMatch(/account is deleted/);
    }
    expect((await db.doc(`users/${MADDIE}`).get()).data()?.status).toBe('deactivated');
    expect((await db.doc('reports/rep-user').get()).data()?.status).toBe('open');
  });
});
