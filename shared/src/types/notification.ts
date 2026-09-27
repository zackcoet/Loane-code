import type { NotificationType } from '../constants';
import type { BaseDoc, Timestampish } from './common';

/**
 * `users/{uid}/notifications/{notificationId}`
 *
 * Powers the Activity tab and push. Written only by Cloud Functions; the
 * owner may mark one read and nothing else.
 */
export interface Notification extends BaseDoc {
  uid: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Who caused it, when there is a person involved. */
  actorUid: string | null;
  actorUsername: string | null;
  actorPhotoUrl: string | null;
  /** Where tapping it should go, e.g. "/bookings/abc123". */
  deepLink: string | null;
  /** Ids so the client can render richer rows without another read. */
  refs: {
    postId?: string;
    listingId?: string;
    bookingId?: string;
    conversationId?: string;
    claimId?: string;
  };
  readAt: Timestampish | null;
  /** Whether we managed to deliver a push for it. */
  pushSentAt: Timestampish | null;
}
