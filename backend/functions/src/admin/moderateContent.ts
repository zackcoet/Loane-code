import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type Comment, type Listing, type Post } from '@loane/shared';
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

/** Hiding a review a student reported as abusive. */
export const hideReview = onCall<HideInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { id, reason: rawReason } = request.data ?? {};
    if (!id) throw invalidArgument('Which review?');
    const reason = requireReason(rawReason, 'Say why it is coming down.');

    const ref = db().collection(COLLECTIONS.reviews).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw notFound('We could not find that review.');

    const batch = db().batch();
    batch.update(ref, { isHidden: true, updatedAt: now() });
    logAdminAction(batch, {
      admin,
      action: 'hide_review',
      targetType: 'user',
      targetId: id,
      notes: reason,
    });
    await batch.commit();

    // TODO: hiding a review does not recompute the subject's average.
    // Deliberate for now — a hidden review is usually hidden for being
    // abusive, not for being wrong, and silently moving someone's
    // rating is its own surprise. Revisit if it comes up.
    return { ok: true };
  },
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
