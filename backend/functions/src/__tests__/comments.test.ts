/**
 * Comments and comment hearts, against the emulator.
 *
 *   - A comment moves the look's count once; deleting it gives it back
 *     once, even when two deletes arrive together.
 *   - Her own comment, or any comment on her own look — nobody else's.
 *   - A heart counts once and alerts the writer once.
 *   - No new heart on a removed comment, or on a comment under a look
 *     that is gone — but taking a heart back always works.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const ELLA = 'uid-ella-comments'; // the look's author
const HARPER = 'uid-harper-comments'; // commenting
const MAYA = 'uid-maya-comments'; // a third girl

type Fn = (req: CallableRequest<unknown>) => Promise<unknown>;
let app: App;
let db: Firestore;
let addComment: Fn;
let deleteComment: Fn;
let likeComment: Fn;
let unlikeComment: Fn;

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

function student(uid: string, username: string) {
  return {
    uid,
    username,
    displayName: username,
    photoUrl: null,
    campusId: 'university-of-south-carolina',
    isVerified: true,
    status: 'active',
  };
}

async function look(status = 'active') {
  await db.doc(`${COLLECTIONS.posts}/p1`).set({
    id: 'p1',
    authorUid: ELLA,
    campusId: 'university-of-south-carolina',
    status,
    settings: { commentsDisabled: false },
    stats: { likeCount: 0, saveCount: 0, commentCount: 0 },
  });
}

async function commentCount() {
  return (await db.doc(`${COLLECTIONS.posts}/p1`).get()).data()!.stats.commentCount as number;
}

async function comment(id: string) {
  return (await db.doc(`${COLLECTIONS.comments}/${id}`).get()).data()!;
}

async function alerts(uid: string, type: string) {
  const snap = await db.collection(`${COLLECTIONS.users}/${uid}/notifications`).get();
  return snap.docs.filter((d) => d.data().type === type).length;
}

async function harperComments(): Promise<string> {
  const { commentId } = (await addComment(as(HARPER, { postId: 'p1', body: 'love this' }))) as {
    commentId: string;
  };
  return commentId;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const comments = await import('../posts/comments');
  const hearts = await import('../social/commentLikes');
  addComment = (r) => comments.addComment.run(r as never);
  deleteComment = (r) => comments.deleteComment.run(r as never);
  likeComment = (r) => hearts.likeComment.run(r as never);
  unlikeComment = (r) => hearts.unlikeComment.run(r as never);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.users,
    COLLECTIONS.posts,
    COLLECTIONS.comments,
    COLLECTIONS.commentLikes,
    COLLECTIONS.rateLimits,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(student(ELLA, 'ellacomments'));
  await db.doc(`${COLLECTIONS.users}/${HARPER}`).set(student(HARPER, 'harpercomments'));
  await db.doc(`${COLLECTIONS.users}/${MAYA}`).set(student(MAYA, 'mayacomments'));
});

describe('commenting', () => {
  it('counts the comment and tells the author', async () => {
    await look();
    await harperComments();
    expect(await commentCount()).toBe(1);
    expect(await alerts(ELLA, 'post_commented')).toBe(1);
  });

  it('not on a look that is gone', async () => {
    await look('removed');
    expect(
      await attempt(() => addComment(as(HARPER, { postId: 'p1', body: 'love this' }))),
    ).toMatch(/no longer up/);
    expect(await commentCount()).toBe(0);
  });
});

describe('deleting a comment', () => {
  it('her own: removed, and the count goes back once', async () => {
    await look();
    const id = await harperComments();
    expect(await attempt(() => deleteComment(as(HARPER, { commentId: id })))).toBe('ok');
    expect((await comment(id)).status).toBe('removed');
    expect(await commentCount()).toBe(0);
    expect(await attempt(() => deleteComment(as(HARPER, { commentId: id })))).toMatch(
      /already gone/,
    );
    expect(await commentCount()).toBe(0);
  });

  it('the look’s author can clear it; a third girl cannot', async () => {
    await look();
    const id = await harperComments();
    expect(await attempt(() => deleteComment(as(MAYA, { commentId: id })))).toMatch(/not yours/);
    expect(await attempt(() => deleteComment(as(ELLA, { commentId: id })))).toBe('ok');
    expect(await commentCount()).toBe(0);
  });

  it('two deletes at once take the count down only once', async () => {
    await look();
    await harperComments();
    const id = await harperComments();
    expect(await commentCount()).toBe(2);
    await Promise.all([
      attempt(() => deleteComment(as(HARPER, { commentId: id }))),
      attempt(() => deleteComment(as(ELLA, { commentId: id }))),
    ]);
    expect(await commentCount()).toBe(1);
  });
});

describe('hearting a comment', () => {
  it('counts once however many taps, and alerts the writer once', async () => {
    await look();
    const id = await harperComments();
    await likeComment(as(MAYA, { commentId: id }));
    await likeComment(as(MAYA, { commentId: id }));
    expect((await comment(id)).likeCount).toBe(1);
    expect(await alerts(HARPER, 'comment_liked')).toBe(1);
    await unlikeComment(as(MAYA, { commentId: id }));
    await unlikeComment(as(MAYA, { commentId: id }));
    expect((await comment(id)).likeCount).toBe(0);
  });

  it('no alert for hearting your own comment', async () => {
    await look();
    const id = await harperComments();
    await likeComment(as(HARPER, { commentId: id }));
    expect((await comment(id)).likeCount).toBe(1);
    expect(await alerts(HARPER, 'comment_liked')).toBe(0);
  });

  it('not on a deleted comment', async () => {
    await look();
    const id = await harperComments();
    await deleteComment(as(HARPER, { commentId: id }));
    expect(await attempt(() => likeComment(as(MAYA, { commentId: id })))).toMatch(
      /no longer there/,
    );
  });

  for (const status of ['removed', 'suspended']) {
    it(`not on a comment under a look that is ${status}, and no alert`, async () => {
      await look();
      const id = await harperComments();
      await db.doc(`${COLLECTIONS.posts}/p1`).update({ status });
      expect(await attempt(() => likeComment(as(MAYA, { commentId: id })))).toMatch(/gone/);
      expect((await comment(id)).likeCount ?? 0).toBe(0);
      expect(await alerts(HARPER, 'comment_liked')).toBe(0);
    });
  }

  it('a heart can still be taken back after the look is gone', async () => {
    await look();
    const id = await harperComments();
    await likeComment(as(MAYA, { commentId: id }));
    await db.doc(`${COLLECTIONS.posts}/p1`).update({ status: 'removed' });
    expect(await attempt(() => unlikeComment(as(MAYA, { commentId: id })))).toBe('ok');
    expect((await comment(id)).likeCount).toBe(0);
  });
});
