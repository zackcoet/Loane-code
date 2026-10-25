import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  LIMITS,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
  messagePreview,
  type Booking,
  type Comment,
  type Conversation,
  type ImageRef,
  type Message,
  type Report,
  type ReportReason,
  type ReportTargetType,
} from '@loane/shared';
import { db, now } from '../lib/admin';
import { rateLimit } from '../lib/rateLimit';
import { invalidArgument } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';
import { isDocId } from '../lib/input';

/**
 * `submitReport`
 *
 * Reports a user, listing, post, rental, comment, review or message.
 *
 * A function rather than a write for one reason above the others: the
 * reporter's identity must be recorded honestly and must never be
 * visible to the person reported. The rules make reports admin-read-only,
 * and this makes sure the reporterUid on the document is really the
 * person who filed it.
 */

interface ReportInput {
  targetType: ReportTargetType;
  targetId: string;
  /**
   * The person behind the thing, as the phone sees it. Ignored — the
   * server looks the person up itself (see below). Kept so older apps
   * that send it are not refused.
   */
  targetUid?: string;
  reason: ReportReason;
  details?: string;
  photos?: ImageRef[];
}

/** Long enough for an admin to judge; a comment or review is short anyway. */
const SNAPSHOT_MAX = 500;

function clip(text: unknown): string | null {
  if (typeof text !== 'string' || text.trim() === '') return null;
  return text.length > SNAPSHOT_MAX ? `${text.slice(0, SNAPSHOT_MAX)}…` : text;
}

export const submitReport = onCall<ReportInput, Promise<{ reportId: string }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<ReportInput>): Promise<{ reportId: string }> => {
    const reporter = await requireActiveUser(request);
    const { targetType, targetId, reason, details = '', photos = [] } = request.data ?? {};

    // Junk input gets a clear answer, and never uses up one of her
    // reports for the day — so these checks come before the limit.
    if (!(REPORT_TARGET_TYPES as readonly string[]).includes(targetType)) {
      throw invalidArgument('What are you reporting?');
    }
    // A message is named "chat/message"; everything else is one id.
    const idOk =
      targetType === 'message'
        ? typeof targetId === 'string' &&
          targetId.split('/').length === 2 &&
          targetId.split('/').every(isDocId)
        : isDocId(targetId);
    if (!idOk) throw invalidArgument('What are you reporting?');
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
      throw invalidArgument('Pick a reason.');
    }
    if (typeof details !== 'string')
      throw invalidArgument('That description did not come through.');
    if (details.length > LIMITS.reportDetails.max) {
      throw invalidArgument('That description is too long.');
    }
    /*
      No photos for now. The app has never sent any, and there is no
      place in storage for a report's photos — so any photo that turned
      up here would be a link to anywhere on the internet, shown to an
      admin in the dashboard. When report photos are built, check each
      is her own upload the way looks and pieces do (lib/downloadUrl).
    */
    if (!Array.isArray(photos) || photos.length > 0) {
      throw invalidArgument('Photos can’t be added to a report yet.');
    }

    await rateLimit(reporter.uid, 'report');

    /*
      Never trust the phone about WHO is behind the thing reported. The
      dashboard's one-click warn and suspend act on targetUid, so a
      tampered app that named someone else could get the wrong girl
      suspended. Every kind of report looks the person up here; the
      targetUid the phone sends is ignored.
    */
    let resolvedTargetUid: string | null = null;
    let snapshot: string | null = null;

    if (targetType === 'user') {
      const snap = await db().collection(COLLECTIONS.users).doc(targetId).get();
      if (!snap.exists) throw invalidArgument('We could not find that student.');
      resolvedTargetUid = targetId;
    }

    if (targetType === 'booking') {
      const bookingSnap = await db().collection(COLLECTIONS.bookings).doc(targetId).get();
      if (!bookingSnap.exists) throw invalidArgument('We could not find that rental.');
      const booking = bookingSnap.data() as Booking;
      const isLender = booking.lenderUid === reporter.uid;
      const isRenter = booking.renterUid === reporter.uid;
      if (!isLender && !isRenter) throw invalidArgument('That rental is not yours.');
      resolvedTargetUid = isLender ? booking.renterUid : booking.lenderUid;
    }

    if (targetType === 'post' || targetType === 'listing') {
      const collection = targetType === 'post' ? COLLECTIONS.posts : COLLECTIONS.listings;
      const snap = await db().collection(collection).doc(targetId).get();
      if (!snap.exists) throw invalidArgument('We could not find that.');
      const data = snap.data() as { authorUid?: string; ownerUid?: string };
      resolvedTargetUid = (targetType === 'post' ? data.authorUid : data.ownerUid) ?? null;
    }

    if (targetType === 'comment' || targetType === 'review') {
      const collection = targetType === 'comment' ? COLLECTIONS.comments : COLLECTIONS.reviews;
      const snap = await db().collection(collection).doc(targetId).get();
      if (!snap.exists) throw invalidArgument('We could not find that.');
      const data = snap.data() as Pick<Comment, 'authorUid' | 'body'>;
      resolvedTargetUid = data.authorUid ?? null;
      // A comment can be deleted and a review hidden before an admin
      // looks, so keep the words that were reported.
      snapshot = clip(data.body);
    }

    if (targetType === 'message') {
      const [conversationId, messageId] = targetId.split('/') as [string, string];
      const threadRef = db().collection(COLLECTIONS.conversations).doc(conversationId);
      const [thread, message] = await Promise.all([
        threadRef.get(),
        threadRef.collection('messages').doc(messageId).get(),
      ]);
      // Only someone in the chat can report what was said in it.
      const participants = (thread.data() as Conversation | undefined)?.participantUids ?? [];
      if (!thread.exists || !message.exists || !participants.includes(reporter.uid)) {
        throw invalidArgument('We could not find that message.');
      }
      const said = message.data() as Message;
      resolvedTargetUid = said.senderUid;
      snapshot = messagePreview(said) || null;
    }

    if (resolvedTargetUid === reporter.uid) {
      throw invalidArgument(
        targetType === 'message' ? 'That is your own message.' : 'That is your own.',
      );
    }

    const ref = db().collection(COLLECTIONS.reports).doc();

    const report: Omit<Report, 'createdAt' | 'updatedAt'> = {
      id: ref.id,
      campusId: reporter.campusId,
      reporterUid: reporter.uid,
      targetType,
      targetId,
      targetUid: resolvedTargetUid,
      reason,
      details: details.trim(),
      photos: [],
      snapshot,
      status: 'open',
      resolution: { adminUid: null, action: null, notes: null, resolvedAt: null },
    };

    await ref.set({ ...report, createdAt: now(), updatedAt: now() });

    logger.info('Report filed', { reportId: ref.id, targetType, reason });
    return { reportId: ref.id };
  },
);
