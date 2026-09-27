import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  LIMITS,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
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
}

export const submitReport = onCall<ReportInput, Promise<{ reportId: string }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<ReportInput>): Promise<{ reportId: string }> => {
    const reporter = await requireActiveUser(request);
    const { targetType, targetId, targetUid, reason, details = '' } = request.data ?? {};

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

    const ref = db().collection(COLLECTIONS.reports).doc();

    const report: Omit<Report, 'createdAt' | 'updatedAt'> = {
      id: ref.id,
      campusId: reporter.campusId,
      reporterUid: reporter.uid,
      targetType,
      targetId,
      targetUid: targetUid ?? null,
      reason,
      details: details.trim(),
      status: 'open',
      resolution: { adminUid: null, action: null, notes: null, resolvedAt: null },
    };

    await ref.set({ ...report, createdAt: now(), updatedAt: now() });

    logger.info('Report filed', { reportId: ref.id, targetType, reason });
    return { reportId: ref.id };
  },
);
