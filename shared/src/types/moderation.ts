import type { ReportReason, ReportStatus, ReportTargetType } from '../constants';
import type { BaseDoc, CampusScoped, ImageRef, Timestampish } from './common';

/**
 * `reports/{reportId}`
 *
 * Someone flagged a user, listing, post, booking or message. Created by a
 * Cloud Function so the reporter cannot forge fields; readable only by
 * admins so a reported user never sees who reported her.
 */
export interface Report extends BaseDoc, CampusScoped {
  reporterUid: string;
  targetType: ReportTargetType;
  /**
   * Id of the reported document. For a message, which lives inside its
   * conversation, this is `conversationId/messageId`.
   */
  targetId: string;
  /** The uid behind the target, so admins can act on the person directly. */
  targetUid: string | null;
  reason: ReportReason;
  details: string;
  photos: ImageRef[];
  /**
   * What was actually said, copied when the report was filed — for a
   * message, its words. Messages are private to the two people in the
   * thread, so without a copy the admin would be judging blind; and if
   * the sender later deletes or edits around it, the report still shows
   * what was reported. Older reports have no field.
   */
  snapshot?: string | null;
  status: ReportStatus;

  /** Admin follow-up. */
  resolution: {
    adminUid: string | null;
    action: 'none' | 'content_removed' | 'user_warned' | 'user_suspended' | 'user_removed' | null;
    notes: string | null;
    resolvedAt: Timestampish | null;
  };
}

/**
 * `users/{uid}/adminNotes/{noteId}`
 *
 * A private note on a student, written only by the `addAdminNote`
 * function and readable only by admins. She never sees it.
 */
export interface AdminNote extends BaseDoc {
  uid: string;
  note: string;
  adminUid: string;
  adminEmail: string | null;
}

/**
 * `adminActions/{actionId}`
 *
 * An append-only audit log. Every admin action writes one of these so we can
 * always answer "who suspended this account and why".
 */
export interface AdminAction extends BaseDoc {
  adminUid: string;
  action: string;
  targetType:
    | ReportTargetType
    | 'campus'
    | 'claim'
    | 'report'
    | 'supportRequest'
    | 'legalDoc'
    /** A runtime switch under `config/`, e.g. the try-on on/off flag. */
    | 'config';
  targetId: string;
  notes: string | null;
  /** Snapshot of what changed, for the audit trail. */
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}
