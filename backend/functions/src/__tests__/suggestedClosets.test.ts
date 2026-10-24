/**
 * "Follow these closets", against the emulator.
 *
 *   - Friends of friends come first, most mutuals first, with the count.
 *   - Topped up with the most-followed closets on her campus.
 *   - Never herself, anyone she follows, has blocked, has dismissed, or
 *     who has blocked her; never a deleted, suspended or other-campus account.
 *   - A girl who falls out at the last step doesn't leave the row short.
 *   - A strange `limit` gets the default instead of an error.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, SUBCOLLECTIONS, ids } from '@loane/shared';

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const ME = 'uid-me-suggest';
const FRIEND_A = 'uid-friend-a-suggest';
const FRIEND_B = 'uid-friend-b-suggest';
const MUTUAL_2 = 'uid-mutual-two-suggest';
const MUTUAL_1 = 'uid-mutual-one-suggest';
const POPULAR = 'uid-popular-suggest';
const QUIET = 'uid-quiet-suggest';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let suggestedClosets: (req: CallableRequest<any>) => Promise<any>;

function as(uid: string, data: unknown): CallableRequest<unknown> {
  return { auth: { uid, token: {} }, data } as unknown as CallableRequest<unknown>;
}

function student(uid: string, followerCount: number, extra: Record<string, unknown> = {}) {
  return {
    uid,
    username: uid.replace(/[^a-z]/g, ''),
    displayName: uid,
    photoUrl: null,
    campusId: CAMPUS,
    isVerified: true,
    status: 'active',
    stats: { followerCount, followingCount: 0 },
    ...extra,
  };
}

async function follows(follower: string, following: string) {
  await db
    .doc(`${COLLECTIONS.follows}/${ids.follow(follower, following)}`)
    .set({ followerUid: follower, followingUid: following });
}

async function suggest(data: unknown = {}) {
  const result = await suggestedClosets(as(ME, data));
  return result.closets as { uid: string; mutualCount: number }[];
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../social/suggestedClosets');
  suggestedClosets = (req) => mod.suggestedClosets.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [COLLECTIONS.users, COLLECTIONS.follows]) {
    await db.recursiveDelete(db.collection(c));
  }
  // Follower counts are deliberately the opposite of the mutual order,
  // so a test can tell which rule put someone where.
  const people: [string, number][] = [
    [ME, 0],
    [FRIEND_A, 1],
    [FRIEND_B, 2],
    [MUTUAL_2, 3],
    [MUTUAL_1, 4],
    [POPULAR, 50],
    [QUIET, 0],
  ];
  for (const [uid, count] of people) {
    await db.doc(`${COLLECTIONS.users}/${uid}`).set(student(uid, count));
  }
  await follows(ME, FRIEND_A);
  await follows(ME, FRIEND_B);
  await follows(FRIEND_A, MUTUAL_2);
  await follows(FRIEND_B, MUTUAL_2);
  await follows(FRIEND_A, MUTUAL_1);
  // Her friends following each other, and her, must not come back.
  await follows(FRIEND_A, FRIEND_B);
  await follows(FRIEND_B, ME);
});

describe('suggestedClosets', () => {
  it('puts friends of friends first, most mutuals first, then the busiest closets', async () => {
    const closets = await suggest();
    expect(closets.map((c) => [c.uid, c.mutualCount])).toEqual([
      [MUTUAL_2, 2],
      [MUTUAL_1, 1],
      [POPULAR, 0],
      [QUIET, 0],
    ]);
  });

  it('leaves out anyone she has blocked, dismissed, or who has blocked her', async () => {
    await db.doc(`${COLLECTIONS.users}/${ME}/${SUBCOLLECTIONS.userBlocked}/${MUTUAL_2}`).set({});
    await db
      .doc(`${COLLECTIONS.users}/${ME}/${SUBCOLLECTIONS.userDismissedSuggestions}/${MUTUAL_1}`)
      .set({});
    await db.doc(`${COLLECTIONS.users}/${POPULAR}/${SUBCOLLECTIONS.userBlocked}/${ME}`).set({});
    expect((await suggest()).map((c) => c.uid)).toEqual([QUIET]);
  });

  it('leaves out deleted, suspended and other-campus accounts', async () => {
    await db.doc(`${COLLECTIONS.users}/${MUTUAL_2}`).update({ status: 'suspended' });
    await db.doc(`${COLLECTIONS.users}/${MUTUAL_1}`).update({ campusId: 'clemson-university' });
    await db.doc(`${COLLECTIONS.users}/${QUIET}`).delete();
    expect((await suggest()).map((c) => c.uid)).toEqual([POPULAR]);
  });

  it("doesn't leave the row short when someone drops out at the last step", async () => {
    // Asked for two. The top mutual has blocked her, so the next in line
    // fills the gap instead of the row coming back with one.
    await db.doc(`${COLLECTIONS.users}/${MUTUAL_2}/${SUBCOLLECTIONS.userBlocked}/${ME}`).set({});
    expect((await suggest({ limit: 2 })).map((c) => c.uid)).toEqual([MUTUAL_1, POPULAR]);
  });

  it('gives a strange limit the default instead of failing', async () => {
    for (const limit of ['10', 2.5, null, -3]) {
      const closets = await suggest({ limit });
      expect(closets.length, String(limit)).toBeGreaterThan(0);
    }
    expect(await suggest({ limit: 1 })).toHaveLength(1);
  });
});
