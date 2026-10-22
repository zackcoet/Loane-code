import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import type { WriteBatch } from 'firebase-admin/firestore';
import {
  brand,
  COLLECTIONS,
  previewShowsMessage,
  ratingFromVisible,
  REMOVED_MESSAGE_TEXT,
  SUBCOLLECTIONS,
  type Comment,
  type Conversation,
  type Message,
  type Report,
  type Review,
  type User,
} from '@loane/shared';
import { db, FieldValue, now } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { logAdminAction, requireAdminContext, requireReason, type AdminContext } from './audit';
import { notify } from '../bookings/transitions';

/**
 * Working a report.
 *
 * `reviewing` is a claim: it says an admin has picked this one up, so
 * two people are not both writing to the same student about it.
 *
 * ACTING AND RESOLVING ARE ONE CALL on purpose. If a report says "this
 * listing is counterfeit", you should be able to take the listing down,
 * suspend the seller and close the report in one action — and get three
 * correctly linked audit rows out of it. Making that three separate
 * clicks is how moderation ends up half-finished.
 */

type Action = 'none' | 'content_removed' | 'user_warned' | 'user_suspended' | 'user_removed';

interface ResolveInput {
  reportId: string;
  /** 'reviewing' to claim it; the others close it. */
  status: 'reviewing' | 'actioned' | 'dismissed';
  action?: Action;
  notes: string;
}

export const resolveReport = onCall<ResolveInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { reportId, status, action = 'none', notes: rawNotes } = request.data ?? {};
    if (!reportId) throw invalidArgument('Which report?');
    if (!['reviewing', 'actioned', 'dismissed'].includes(status)) {
      throw invalidArgument('Pick what is happening to this report.');
    }
    const notes = requireReason(rawNotes, 'Write what you found. Future-you will want it.');

    const ref = db().collection(COLLECTIONS.reports).doc(reportId);
    const snap = await ref.get();
    if (!snap.exists) throw notFound('We could not find that report.');

    const report = snap.data() as Report;
    if (report.status === 'actioned' || report.status === 'dismissed') {
      throw failed('That report is already closed.');
    }

    const batch = db().batch();

    batch.update(ref, {
      status,
      resolution: {
        adminUid: admin.uid,
        action: status === 'reviewing' ? null : action,
        notes,
        resolvedAt: status === 'reviewing' ? null : now(),
      },
      updatedAt: now(),
    });
    logAdminAction(batch, {
      admin,
      action: `report_${status}`,
      targetType: 'report',
      targetId: reportId,
      notes,
      before: { status: report.status },
      after: { status, action },
    });

    // --- Carry out the action, in the same commit --------------------
    if (status === 'actioned' && action !== 'none') {
      if (action === 'content_removed' && report.targetType === 'comment') {
        // A comment comes down the same way hideComment takes it down:
        // suspended (she cannot undo ours), and the look's count follows.
        const commentRef = db().collection(COLLECTIONS.comments).doc(report.targetId);
        const commentSnap = await commentRef.get();
        if (!commentSnap.exists) throw notFound('That comment is already gone.');
        const comment = commentSnap.data() as Comment;
        if (comment.status === 'active') {
          batch.update(commentRef, {
            status: 'suspended',
            suspendedReason: notes,
            updatedAt: now(),
          });
          const postRef = db().collection(COLLECTIONS.posts).doc(comment.postId);
          if ((await postRef.get()).exists) {
            batch.update(postRef, {
              'stats.commentCount': FieldValue.increment(-1),
              updatedAt: now(),
            });
          }
        }
        logAdminAction(batch, {
          admin,
          action: 'hide_comment',
          targetType: 'comment',
          targetId: report.targetId,
          notes: `From report ${reportId}: ${notes}`,
          before: { status: comment.status },
          after: { status: 'suspended' },
        });
      } else if (action === 'content_removed' && report.targetType === 'review') {
        await takeDownReview(batch, admin, report, reportId, notes);
      } else if (action === 'content_removed' && report.targetType === 'message') {
        await takeDownMessage(batch, admin, report, reportId, notes);
      } else if (action === 'content_removed') {
        const collection =
          report.targetType === 'listing'
            ? COLLECTIONS.listings
            : report.targetType === 'post'
              ? COLLECTIONS.posts
              : null;

        if (!collection) {
          throw failed(
            'There is nothing to take down for this kind of report. Warn or suspend her instead.',
          );
        }

        const targetRef = db().collection(collection).doc(report.targetId);
        const targetSnap = await targetRef.get();
        if (!targetSnap.exists) throw notFound('That content is already gone.');

        batch.update(targetRef, {
          status: 'suspended',
          suspendedReason: notes,
          updatedAt: now(),
        });
        logAdminAction(batch, {
          admin,
          action: `hide_${report.targetType}`,
          targetType: report.targetType,
          targetId: report.targetId,
          notes: `From report ${reportId}: ${notes}`,
        });
      }

      if (action === 'user_suspended' || action === 'user_warned') {
        if (!report.targetUid) throw failed('This report has no student attached.');

        const userRef = db().collection(COLLECTIONS.users).doc(report.targetUid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) throw notFound('We could not find that student.');

        const user = userSnap.data() as User;
        if (report.targetUid === admin.uid) throw failed("You can't action yourself.");
        if (user.role === 'admin') throw failed('Admins cannot be suspended from here.');

        if (action === 'user_suspended') {
          batch.update(userRef, {
            status: 'suspended',
            suspendedReason: notes,
            updatedAt: now(),
          });
          logAdminAction(batch, {
            admin,
            action: 'suspend_user',
            targetType: 'user',
            targetId: report.targetUid,
            notes: `From report ${reportId}: ${notes}`,
            before: { status: user.status },
            after: { status: 'suspended' },
          });
        }

        notify(batch, {
          uid: report.targetUid,
          type: 'admin_notice',
          title: action === 'user_suspended' ? 'Your account is suspended' : 'A warning from Loane',
          body: `${notes} Write to ${brand.supportEmail} if you think this is wrong.`,
          bookingId: '',
        });
      }
    }

    await batch.commit();
    logger.info('Report resolved', { reportId, status, action, by: admin.uid });
    return { ok: true };
  },
);

/**
 * A reported review comes down the same way the Reviews page hides one:
 * `isHidden`, and the person it was about gets her rating recomputed
 * from the reviews still showing — a hidden one-star must count for
 * nothing. Already hidden (someone got there from the Reviews page
 * first) is fine: the report still closes, nothing is counted twice.
 */
async function takeDownReview(
  batch: WriteBatch,
  admin: AdminContext,
  report: Report,
  reportId: string,
  notes: string,
): Promise<void> {
  const ref = db().collection(COLLECTIONS.reviews).doc(report.targetId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound('That review is already gone.');
  const review = snap.data() as Review;
  if (review.isHidden) return;

  const siblings = await db()
    .collection(COLLECTIONS.reviews)
    .where('subjectUid', '==', review.subjectUid)
    .get();
  const rating = ratingFromVisible(
    siblings.docs.map((d) => ({ ...(d.data() as Review), id: d.id })),
    { id: report.targetId, hide: true },
  );

  batch.update(ref, { isHidden: true, updatedAt: now() });
  batch.update(db().collection(COLLECTIONS.users).doc(review.subjectUid), {
    'stats.ratingCount': rating.ratingCount,
    'stats.ratingAverage': rating.ratingAverage,
    updatedAt: now(),
  });
  logAdminAction(batch, {
    admin,
    action: 'hide_review',
    targetType: 'review',
    targetId: report.targetId,
    notes: `From report ${reportId}: ${notes}`,
    before: { isHidden: false, rating: review.rating },
    after: { isHidden: true, ...rating },
  });
}

/**
 * A reported message comes down for BOTH people in the chat.
 *
 * Its words, photo and any shared card are blanked, not just flagged:
 * the two people in a chat can read its messages directly, so a flag
 * alone would only hide it from a well-behaved app. The original is
 * kept in the audit row (admins only), and the report already holds a
 * copy of what was said. Replies that quoted it already show "Message
 * unavailable", and nobody can heart or reply to it any more — the
 * security rules check `isDeleted`. If it was the newest message, the
 * inbox preview is replaced too, or the words would live on there.
 */
async function takeDownMessage(
  batch: WriteBatch,
  admin: AdminContext,
  report: Report,
  reportId: string,
  notes: string,
): Promise<void> {
  const [conversationId, messageId] = report.targetId.split('/');
  if (!conversationId || !messageId) throw failed('This report does not point at a message.');

  const conversationRef = db().collection(COLLECTIONS.conversations).doc(conversationId);
  const messageRef = conversationRef.collection(SUBCOLLECTIONS.messages).doc(messageId);
  const [conversationSnap, messageSnap] = await Promise.all([
    conversationRef.get(),
    messageRef.get(),
  ]);
  if (!messageSnap.exists) throw notFound('That message is already gone.');
  const message = messageSnap.data() as Message;
  if (message.isDeleted) return;

  batch.update(messageRef, {
    isDeleted: true,
    body: '',
    photo: null,
    sharedPost: null,
    sharedListing: null,
    likedBy: [],
    updatedAt: now(),
  });

  const conversation = conversationSnap.data() as Conversation | undefined;
  if (conversation && previewShowsMessage(conversation.lastMessage, message)) {
    batch.update(conversationRef, {
      'lastMessage.body': REMOVED_MESSAGE_TEXT,
      updatedAt: now(),
    });
  }

  logAdminAction(batch, {
    admin,
    action: 'hide_message',
    targetType: 'message',
    targetId: report.targetId,
    notes: `From report ${reportId}: ${notes}`,
    before: {
      body: message.body,
      photoPath: message.photo?.path ?? null,
      sharedPostId: message.sharedPost?.postId ?? null,
      sharedListingId: message.sharedListing?.listingId ?? null,
    },
    after: { isDeleted: true },
  });
}
