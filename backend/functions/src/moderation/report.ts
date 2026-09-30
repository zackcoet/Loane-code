import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  LIMITS,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
  type Booking,
  type ImageRef,
  type Report,
  type ReportReason,
  type ReportTargetType,
} from '@loane/shared';
import { db, now } from '../lib/admin';
import { invalidArgument } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';

/**
 * `submitReport`
 *
 * Reports a user, listing, post or rental.
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
  /** The person behind the thing, when there is one. */
  targetUid?: string;
  reason: ReportReason;
  details?: string;
  photos?: ImageRef[];
}

export const submitReport = onCall<ReportInput, Promise<{ reportId: string }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<ReportInput>): Promise<{ reportId: string }> => {
    const reporter = await requireActiveUser(request);
    const { targetType, targetId, targetUid, reason, details = '', photos = [] } = request.data ?? {};

    if (!(REPORT_TARGET_TYPES as readonly string[]).includes(targetType)) {
      throw invalidArgument('What are you reporting?');
    }
    if (!targetId) throw invalidArgument('What are you reporting?');
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
      throw invalidArgument('Pick a reason.');
    }
    if (details.length > LIMITS.reportDetails.max) {
      throw invalidArgument('That description is too long.');
    }
    if (!Array.isArray(photos) || photos.length > 4) {
      throw invalidArgument('Add up to four photos.');
    }

    let resolvedTargetUid = targetUid ?? null;
    if (targetType === 'booking') {
      const bookingSnap = await db().collection(COLLECTIONS.bookings).doc(targetId).get();
      if (!bookingSnap.exists) throw invalidArgument('We could not find that rental.');
      const booking = bookingSnap.data() as Booking;
      const isLender = booking.lenderUid === reporter.uid;
      const isRenter = booking.renterUid === reporter.uid;
      if (!isLender && !isRenter) throw invalidArgument('That rental is not yours.');
      resolvedTargetUid = isLender ? booking.renterUid : booking.lenderUid;
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
      photos,
      status: 'open',
      resolution: { adminUid: null, action: null, notes: null, resolvedAt: null },
    };

    await ref.set({ ...report, createdAt: now(), updatedAt: now() });

    logger.info('Report filed', { reportId: ref.id, targetType, reason });
    return { reportId: ref.id };
  },
);
