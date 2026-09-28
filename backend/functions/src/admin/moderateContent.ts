import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type Comment, type Listing, type Post, type Review } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { logAdminAction, requireAdminContext, requireReason } from './audit';
import { notify } from '../bookings/transitions';

/**
 * Taking a listing or a post down, and putting it back.
 *
 * `suspended` rather than `removed` on purpose: `removed` is what the
 * owner chose, `suspended` is what we did. Keeping them apart means a
 * student cannot quietly un-suspend her own listing by "restoring" it
 * — the rules already forbid her writing `suspendedReason` at all.
 *
 * Nothing is deleted. A taken-down listing is evidence if the same
 * person turns up in a second report.
 */

interface HideInput {
  id: string;
  reason: string;
}

async function moderate(
  request: Parameters<typeof requireAdminContext>[0],
  kind: 'listing' | 'post',
  hide: boolean,
): Promise<{ ok: true }> {
  const admin = requireAdminContext(request);
  const data = (request.data ?? {}) as HideInput;
  if (!data.id) throw invalidArgument(`Which ${kind}?`);

  const reason = requireReason(
    data.reason,
    hide ? 'Say why it is coming down.' : 'Say why it is going back up.',
  );

  const collection = kind === 'listing' ? COLLECTIONS.listings : COLLECTIONS.posts;
  const ref = db().collection(collection).doc(data.id);
  const snap = await ref.get();
  if (!snap.exists) throw notFound(`We could not find that ${kind}.`);

  const doc = snap.data() as Listing | Post;
  const ownerUid = 'ownerUid' in doc ? doc.ownerUid : doc.authorUid;

  if (hide && doc.status === 'suspended') throw failed('It is already down.');
  if (!hide && doc.status !== 'suspended') throw failed('It is not suspended.');

  const batch = db().batch();
  batch.update(ref, {
    status: hide ? 'suspended' : 'active',
    suspendedReason: hide ? reason : null,
    updatedAt: now(),
  });
  notify(batch, {
    uid: ownerUid,
    type: 'admin_notice',
    title: hide
      ? `Your ${kind} was taken down`
      : `Your ${kind} is back up`,
    body: hide ? reason : 'It is visible on your campus again.',
    bookingId: '',
  });
  logAdminAction(batch, {
    admin,
    action: hide ? `hide_${kind}` : `restore_${kind}`,
    targetType: kind,
    targetId: data.id,
    notes: reason,
    before: { status: doc.status },
    after: { status: hide ? 'suspended' : 'active' },
  });
  await batch.commit();

  logger.info(`${kind} ${hide ? 'hidden' : 'restored'}`, { id: data.id, by: admin.uid });
  return { ok: true };
}

export const hideListing = onCall<HideInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  (r) => moderate(r, 'listing', true),
);
export const restoreListing = onCall<HideInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  (r) => moderate(r, 'listing', false),
);
export const hidePost = onCall<HideInput, Promise<{ ok: true }>>({ region: 'us-central1' }, (r) =>
  moderate(r, 'post', true),
);
export const restorePost = onCall<HideInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  (r) => moderate(r, 'post', false),
);

/**
 * Hiding a review, and putting it back.
 *
 * The average moves with it. It used not to, on the reasoning that a
 * review is usually hidden for being abusive rather than wrong — but
 * that left a one-star review still dragging somebody's rating down
 * from behind a curtain, invisible to her and to anyone deciding
 * whether to rent from her. A hidden review has to count for nothing.
 *
 * The average is RECOMPUTED FROM THE VISIBLE REVIEWS rather than
 * adjusted by arithmetic. Adding and subtracting works until the day
 * two moderators act at once, or a review is hidden twice, and then
 * the number drifts with nothing to correct it. Reading the reviews is
 * a handful of documents and is always right.
 */
async function moderateReview(
  request: Parameters<typeof requireAdminContext>[0],
  hide: boolean,
): Promise<{ ok: true }> {
  const admin = requireAdminContext(request);
  const { id, reason: rawReason } = (request.data ?? {}) as HideInput;
  if (!id) throw invalidArgument('Which review?');
  const reason = requireReason(
    rawReason,
    hide ? 'Say why it is coming down.' : 'Say why it is going back up.',
  );

  const ref = db().collection(COLLECTIONS.reviews).doc(id);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound('We could not find that review.');
    const review = snap.data() as Review;

    if (hide && review.isHidden) throw failed('It is already hidden.');
    if (!hide && !review.isHidden) throw failed('It is not hidden.');

    // Every review for this person, so we can count the visible ones
    // once the change is applied.
    const siblings = await tx.get(
      db().collection(COLLECTIONS.reviews).where('subjectUid', '==', review.subjectUid),
    );

    const visible = siblings.docs
      .map((d) => ({ ...(d.data() as Review), id: d.id }))
      .filter((r) => (r.id === id ? !hide : !r.isHidden));

    const count = visible.length;
    const average =
      count === 0
        ? null
        : Math.round((visible.reduce((sum, r) => sum + r.rating, 0) / count) * 100) / 100;

    tx.update(ref, { isHidden: hide, updatedAt: now() });
    tx.update(db().collection(COLLECTIONS.users).doc(review.subjectUid), {
      'stats.ratingCount': count,
      'stats.ratingAverage': average,
      updatedAt: now(),
    });

    logAdminAction(tx, {
      admin,
      action: hide ? 'hide_review' : 'restore_review',
      targetType: 'review',
      targetId: id,
      notes: reason,
      before: { isHidden: review.isHidden, rating: review.rating },
      after: { isHidden: hide, ratingCount: count, ratingAverage: average },
    });
  });

  logger.info(`review ${hide ? 'hidden' : 'restored'}`, { id, by: admin.uid });
  return { ok: true };
}

export const hideReview = onCall<HideInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  (r) => moderateReview(r, true),
);
export const restoreReview = onCall<HideInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  (r) => moderateReview(r, false),
);

/**
 * Taking a comment down, and putting it back.
 *
 * Separate from `hidePost` because a comment carries no tag counts and
 * its own count sits on someone else's post, so hiding one has to move
 * that post's `commentCount` as well. Same `suspended` vs `removed`
 * split as everywhere else: `removed` is what she chose, `suspended` is
 * what we did, and she cannot undo ours.
 */
async function moderateComment(
  request: Parameters<typeof requireAdminContext>[0],
  hide: boolean,
): Promise<{ ok: true }> {
  const admin = requireAdminContext(request);
  const data = (request.data ?? {}) as HideInput;
  if (!data.id) throw invalidArgument('Which comment?');

  const reason = requireReason(
    data.reason,
    hide ? 'Say why it is coming down.' : 'Say why it is going back up.',
  );

  const ref = db().collection(COLLECTIONS.comments).doc(data.id);
  const snap = await ref.get();
  if (!snap.exists) throw notFound('We could not find that comment.');

  const comment = snap.data() as Comment;
  if (hide && comment.status !== 'active') throw failed('It is already down.');
  if (!hide && comment.status !== 'suspended') throw failed('It is not suspended.');

  const batch = db().batch();
  batch.update(ref, {
    status: hide ? 'suspended' : 'active',
    suspendedReason: hide ? reason : null,
    updatedAt: now(),
  });

  // The count under the post has to follow the comment either way.
  const postRef = db().collection(COLLECTIONS.posts).doc(comment.postId);
  if ((await postRef.get()).exists) {
    batch.update(postRef, {
      'stats.commentCount': FieldValue.increment(hide ? -1 : 1),
      updatedAt: now(),
    });
  }

  notify(batch, {
    uid: comment.authorUid,
    type: 'admin_notice',
    title: hide ? 'Your comment was taken down' : 'Your comment is back up',
    body: hide ? reason : 'It is visible again.',
    bookingId: '',
  });
  logAdminAction(batch, {
    admin,
    action: hide ? 'hide_comment' : 'restore_comment',
    targetType: 'comment',
    targetId: data.id,
    notes: reason,
    before: { status: comment.status },
    after: { status: hide ? 'suspended' : 'active' },
  });
  await batch.commit();

  logger.info(`comment ${hide ? 'hidden' : 'restored'}`, { id: data.id, by: admin.uid });
  return { ok: true };
}

export const hideComment = onCall<HideInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  (r) => moderateComment(r, true),
);
export const restoreComment = onCall<HideInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  (r) => moderateComment(r, false),
);
