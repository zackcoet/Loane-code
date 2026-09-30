import type { SupportRequestStatus, SupportTopic } from '../constants';
import type { BaseDoc, CampusScoped, Timestampish, UserSummary } from './common';

/**
 * `supportRequests/{requestId}`
 *
 * General contact-us messages. Rental problems use `reports` instead so
 * they land in the moderation queue linked to the booking.
 */
export interface SupportRequest extends BaseDoc, CampusScoped {
  requesterUid: string;
  requester: UserSummary;
  topic: SupportTopic;
  message: string;
  status: SupportRequestStatus;
  resolvedAt: Timestampish | null;
  resolvedByUid: string | null;
}
