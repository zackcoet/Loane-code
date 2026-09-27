import type { BaseDoc, CampusScoped, ImageRef, Timestampish, UserSummary } from './common';

/**
 * `conversations/{conversationId}`
 *
 * 1:1 only for MVP. The id is the two uids sorted and joined with "_", so a
 * pair of users can never end up with two threads.
 */
export interface Conversation extends BaseDoc, CampusScoped {
  /** Exactly two uids, sorted. Used for array-contains queries. */
  participantUids: string[];
  /** Denormalized so the inbox renders in one read. */
  participants: Record<string, UserSummary>;

  /** Optional: the booking or listing that started the thread. */
  listingId: string | null;
  bookingId: string | null;

  lastMessage: {
    body: string;
    senderUid: string;
    sentAt: Timestampish;
  } | null;

  /** Unread count per uid, kept by a Cloud Function. */
  unreadCounts: Record<string, number>;
}

/**
 * `conversations/{conversationId}/messages/{messageId}`
 */
export interface Message extends BaseDoc {
  conversationId: string;
  senderUid: string;
  body: string;
  /**
   * An attached photo. Worth having because the two most common things
   * to say in a rental chat are "does this look right?" and "this was
   * already like this" — both of which are pictures, not sentences.
   */
  photo: ImageRef | null;
  readBy: string[];
  /** Soft delete so moderation can still see it. */
  isDeleted: boolean;
}
