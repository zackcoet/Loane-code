import type { WriteBatch } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import {
  AUTO_FILTER_REPORTER_UID,
  COLLECTIONS,
  flaggedTerms,
  type Report,
  type ReportTargetType,
} from '@loane/shared';
import { db, now } from '../lib/admin';

/**
 * Files an automatic report when a caption, comment or message matches
 * the word list (shared/src/contentFilter.ts). It lands in the same
 * admin Reports queue as a student's report, from "the content filter".
 *
 * Queued onto the caller's batch where there is one, so the report
 * exists exactly when the content does. Never throws on a match:
 * flagging is for review, not refusal.
 *
 * Returns whether anything matched.
 */
export function queueAutoFlag(
  batch: WriteBatch,
  input: {
    targetType: ReportTargetType;
    targetId: string;
    targetUid: string;
    campusId: string;
    text: string | null | undefined;
    /** Extra id part for content that can be flagged more than once, e.g. an edit. */
    idSuffix?: string;
  },
): boolean {
  const terms = flaggedTerms(input.text);
  if (terms.length === 0) return false;

  // One id per piece of content, so a trigger that runs twice files one
  // report, not two. Slashes in a message's id are not allowed in an id.
  const ref = db()
    .collection(COLLECTIONS.reports)
    .doc(
      [`auto_${input.targetType}_${input.targetId.replace(/\//g, '_')}`, input.idSuffix]
        .filter(Boolean)
        .join('_'),
    );
  const report: Omit<Report, 'createdAt' | 'updatedAt'> = {
    id: ref.id,
    campusId: input.campusId,
    reporterUid: AUTO_FILTER_REPORTER_UID,
    targetType: input.targetType,
    targetId: input.targetId,
    targetUid: input.targetUid,
    reason: 'inappropriate_content',
    details: `Automatic filter matched: ${terms.join(', ')}`,
    photos: [],
    snapshot: input.text ?? null,
    status: 'open',
    resolution: { adminUid: null, action: null, notes: null, resolvedAt: null },
  };
  batch.set(ref, { ...report, createdAt: now(), updatedAt: now() });
  // The terms only, never the text — logs are read more widely than reports.
  logger.info('Content auto-flagged', { targetType: input.targetType, terms });
  return true;
}
