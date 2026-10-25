/**
 * Blocking and reporting, against the emulator.
 *
 *   - Blocking writes both markers and takes the follows away, counting
 *     each follow down once — even when Block is tapped twice at once.
 *   - Blocking herself, a missing account or junk gets a clear answer.
 *   - Unblocking removes both markers.
 *   - A report names the person the SERVER finds behind the thing, never
 *     whoever the phone said — the dashboard's warn and suspend act on it.
 *   - A reported comment or review keeps a copy of its words.
 *   - Her own things, photos and junk are refused, and a refused report
 *     doesn't use up one of her reports for the day.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, ids } from '@loane/shared';

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const ELLA = 'uid-ella-block';
const HARPER = 'uid-harper-block';
const MAYA = 'uid-maya-block';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = (req: CallableRequest<any>) => Promise<any>;
let blockUser: Fn;
let unblockUser: Fn;
let submitReport: Fn;

function as(uid: string, data: unknown): CallableRequest<unknown> {
  return { auth: { uid, token: {} }, data } as unknown as CallableRequest<unknown>;
}

async function attempt(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'ok';
  } catch (error) {
    return (error as { message?: string }).message ?? 'error';
  }
}

function student(uid: string) {
  return {
    uid,
    username: uid.replace(/[^a-z]/g, ''),
    displayName: uid,
    photoUrl: null,
    campusId: CAMPUS,
    isVerified: true,
    status: 'active',
    stats: { followerCount: 1, followingCount: 1 },
  };
}

async function stats(uid: string) {
  return (await db.doc(`${COLLECTIONS.users}/${uid}`).get()).data()!.stats;
}

async function exists(path: string) {
  return (await db.doc(path).get()).exists;
}

async function reports() {
  return (await db.collection(COLLECTIONS.reports).get()).docs.map((d) => d.data());
}

function report(data: Record<string, unknown>) {
  return { reason: 'harassment', details: '', ...data };
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const block = await import('../moderation/block');
  const rep = await import('../moderation/report');
  blockUser = (req) => block.blockUser.run(req);
  unblockUser = (req) => block.unblockUser.run(req);
  submitReport = (req) => rep.submitReport.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.users,
    COLLECTIONS.follows,
    COLLECTIONS.rateLimits,
    COLLECTIONS.reports,
    COLLECTIONS.posts,
    COLLECTIONS.listings,
    COLLECTIONS.comments,
    COLLECTIONS.reviews,
    COLLECTIONS.bookings,
    COLLECTIONS.conversations,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  for (const uid of [ELLA, HARPER, MAYA]) {
    await db.doc(`${COLLECTIONS.users}/${uid}`).set(student(uid));
  }
  // Ella and Harper follow each other: each has 1 follower, 1 following.
  for (const [from, to] of [
    [ELLA, HARPER],
    [HARPER, ELLA],
  ] as const) {
    await db
      .doc(`${COLLECTIONS.follows}/${ids.follow(from, to)}`)
      .set({ followerUid: from, followingUid: to, campusId: CAMPUS });
  }
});

describe('blockUser', () => {
  it('writes both markers and takes both follows away, counting down once', async () => {
    expect(await attempt(() => blockUser(as(ELLA, { uid: HARPER })))).toBe('ok');
    expect(await exists(`${COLLECTIONS.users}/${ELLA}/blocked/${HARPER}`)).toBe(true);
    expect(await exists(`${COLLECTIONS.users}/${HARPER}/blockedBy/${ELLA}`)).toBe(true);
    expect(await exists(`${COLLECTIONS.follows}/${ids.follow(ELLA, HARPER)}`)).toBe(false);
    expect(await exists(`${COLLECTIONS.follows}/${ids.follow(HARPER, ELLA)}`)).toBe(false);
    expect(await stats(ELLA)).toMatchObject({ followerCount: 0, followingCount: 0 });
    expect(await stats(HARPER)).toMatchObject({ followerCount: 0, followingCount: 0 });
  });

  it('two taps at the same moment still count each follow down once', async () => {
    const results = await Promise.all([
      attempt(() => blockUser(as(ELLA, { uid: HARPER }))),
      attempt(() => blockUser(as(ELLA, { uid: HARPER }))),
    ]);
    expect(results).toEqual(['ok', 'ok']);
    expect(await stats(ELLA)).toMatchObject({ followerCount: 0, followingCount: 0 });
    expect(await stats(HARPER)).toMatchObject({ followerCount: 0, followingCount: 0 });
  });

  it('blocking someone she does not follow leaves the counts alone', async () => {
    expect(await attempt(() => blockUser(as(ELLA, { uid: MAYA })))).toBe('ok');
    expect(await stats(MAYA)).toMatchObject({ followerCount: 1, followingCount: 1 });
    expect(await stats(ELLA)).toMatchObject({ followerCount: 1, followingCount: 1 });
  });

  it('refuses herself, a missing account and junk', async () => {
    expect(await attempt(() => blockUser(as(ELLA, { uid: ELLA })))).toMatch(/block yourself/);
    expect(await attempt(() => blockUser(as(ELLA, { uid: 'nobody' })))).toMatch(/could not find/);
    for (const uid of [undefined, 7, '', 'a/b', { x: 1 }]) {
      expect(await attempt(() => blockUser(as(ELLA, { uid })))).toMatch(/Who do you want/);
    }
    expect(await stats(HARPER)).toMatchObject({ followerCount: 1, followingCount: 1 });
  });
});

describe('unblockUser', () => {
  it('removes both markers, and junk gets a clear answer', async () => {
    await blockUser(as(ELLA, { uid: HARPER }));
    expect(await attempt(() => unblockUser(as(ELLA, { uid: HARPER })))).toBe('ok');
    expect(await exists(`${COLLECTIONS.users}/${ELLA}/blocked/${HARPER}`)).toBe(false);
    expect(await exists(`${COLLECTIONS.users}/${HARPER}/blockedBy/${ELLA}`)).toBe(false);
    expect(await attempt(() => unblockUser(as(ELLA, { uid: 'a/b' })))).toMatch(/Who do you want/);
  });
});

describe('submitReport', () => {
  it('a profile report names that student, even when the phone sends no one', async () => {
    await submitReport(as(ELLA, report({ targetType: 'user', targetId: HARPER })));
    const [filed] = await reports();
    expect(filed).toMatchObject({ reporterUid: ELLA, targetType: 'user', targetUid: HARPER });
  });

  it('ignores the person the phone names, and looks them up instead', async () => {
    await db
      .doc(`${COLLECTIONS.comments}/c1`)
      .set({ postId: 'p1', authorUid: HARPER, body: 'mean words', status: 'active' });
    await db
      .doc(`${COLLECTIONS.reviews}/r1`)
      .set({ bookingId: 'b1', authorUid: HARPER, subjectUid: ELLA, body: 'unfair', rating: 1 });
    await db.doc(`${COLLECTIONS.posts}/p1`).set({ authorUid: HARPER, campusId: CAMPUS });

    // A tampered app points every report at Maya.
    await submitReport(
      as(ELLA, report({ targetType: 'comment', targetId: 'c1', targetUid: MAYA })),
    );
    await submitReport(as(ELLA, report({ targetType: 'review', targetId: 'r1', targetUid: MAYA })));
    await submitReport(as(ELLA, report({ targetType: 'post', targetId: 'p1', targetUid: MAYA })));
    await submitReport(as(ELLA, report({ targetType: 'user', targetId: HARPER, targetUid: MAYA })));

    const filed = await reports();
    expect(filed).toHaveLength(4);
    expect(filed.every((r) => r.targetUid === HARPER)).toBe(true);
    expect(filed.find((r) => r.targetType === 'comment')?.snapshot).toBe('mean words');
    expect(filed.find((r) => r.targetType === 'review')?.snapshot).toBe('unfair');
  });

  it('a message report names its sender, and only someone in the chat can file it', async () => {
    await db
      .doc(`${COLLECTIONS.conversations}/t1`)
      .set({ participantUids: [ELLA, HARPER], campusId: CAMPUS });
    await db
      .doc(`${COLLECTIONS.conversations}/t1/messages/m1`)
      .set({ senderUid: HARPER, type: 'text', text: 'rude', createdAt: new Date() });

    expect(
      await attempt(() =>
        submitReport(as(MAYA, report({ targetType: 'message', targetId: 't1/m1' }))),
      ),
    ).toMatch(/could not find that message/);
    expect(
      await attempt(() =>
        submitReport(as(HARPER, report({ targetType: 'message', targetId: 't1/m1' }))),
      ),
    ).toMatch(/your own message/);
    await submitReport(
      as(ELLA, report({ targetType: 'message', targetId: 't1/m1', targetUid: MAYA })),
    );
    const [filed] = await reports();
    expect(filed).toMatchObject({ targetType: 'message', targetUid: HARPER });
  });

  it('refuses her own things, missing things, photos and junk', async () => {
    await db.doc(`${COLLECTIONS.posts}/mine`).set({ authorUid: ELLA, campusId: CAMPUS });
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ targetType: 'user', targetId: ELLA }, /your own/],
      [{ targetType: 'post', targetId: 'mine' }, /your own/],
      [{ targetType: 'user', targetId: 'nobody' }, /could not find/],
      [{ targetType: 'comment', targetId: 'gone' }, /could not find/],
      [{ targetType: 'review', targetId: 'gone' }, /could not find/],
      [{ targetType: 'post', targetId: 'a/b' }, /What are you reporting/],
      [{ targetType: 'post', targetId: 7 }, /What are you reporting/],
      [{ targetType: 'message', targetId: 't1' }, /What are you reporting/],
      [{ targetType: 'message', targetId: 't1/m1/x' }, /What are you reporting/],
      [{ targetType: 'nonsense', targetId: HARPER }, /What are you reporting/],
      [{ targetType: 'user', targetId: HARPER, reason: 'bored' }, /Pick a reason/],
      [{ targetType: 'user', targetId: HARPER, details: 42 }, /did not come through/],
      [{ targetType: 'user', targetId: HARPER, details: 'x'.repeat(1001) }, /too long/],
      [
        { targetType: 'user', targetId: HARPER, photos: [{ url: 'https://example.com/a.jpg' }] },
        /Photos can/,
      ],
    ];
    for (const [data, expected] of cases) {
      expect(await attempt(() => submitReport(as(ELLA, report(data))))).toMatch(expected);
    }
    expect(await reports()).toHaveLength(0);
  });

  it('a refused report does not use up one of her reports for the day', async () => {
    for (let i = 0; i < 25; i += 1) {
      await attempt(() => submitReport(as(ELLA, report({ targetType: 'post', targetId: 'a/b' }))));
    }
    expect(
      await attempt(() => submitReport(as(ELLA, report({ targetType: 'user', targetId: HARPER })))),
    ).toBe('ok');
  });
});
