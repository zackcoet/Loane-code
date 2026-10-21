import type { ListingIntent } from '../constants';
import type { BaseDoc, CampusScoped, Cents, ImageRef, Timestampish, UserSummary } from './common';

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

  /**
   * When each person last had the thread open, per uid. Drives "Seen"
   * under the newest message.
   *
   * One timestamp per person rather than marking every message read,
   * because opening a long thread would otherwise be a hundred writes.
   * Written by her own phone, and the rules hold it to the server's
   * clock so nobody can claim to have seen something in the future.
   * Older threads have no field at all.
   */
  lastReadAt?: Record<string, Timestampish>;
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

  /**
   * A look sent into the chat.
   *
   * Stored as a snapshot rather than just a post id so the bubble
   * renders immediately, and so a shared look does not turn into a
   * blank card if the post is later taken down. Tapping it opens the
   * live post, which is where the truth is.
   */
  sharedPost: {
    postId: string;
    photoUrl: string | null;
    caption: string;
    authorUsername: string;
  } | null;
  /**
   * A piece from someone's closet sent into the chat — "would this
   * work for Saturday?". A snapshot for the same reasons as sharedPost:
   * it renders instantly, and a piece that later comes down leaves a
   * card behind rather than a hole. Tapping it opens the live listing,
   * which is where the real price and dates are. Written only by the
   * shareListing function. Older messages have no field at all.
   */
  sharedListing?: SharedListing | null;
  /**
   * The message this one answers, when she swiped to reply.
   *
   * A copy of the original rather than just its id, for the same reason
   * as sharedPost: the quote renders instantly even when the original is
   * far up the thread and not loaded. The security rules check the copy
   * against the real message, so nobody can put words in someone else's
   * mouth by forging a quote. Older messages have no field at all.
   */
  replyTo?: MessageReply | null;
  readBy: string[];
  /**
   * Who has hearted this message — double-tap, like Instagram. At most
   * the two people in the thread. Each person may add or remove only
   * herself; the rules check that. Older messages have no field.
   */
  likedBy?: string[];
  /** Soft delete so moderation can still see it. */
  isDeleted: boolean;
}

/** The quoted original inside a reply. See Message.replyTo. */
export interface MessageReply {
  messageId: string;
  senderUid: string;
  /** The original's words, copied whole. May be empty for a photo. */
  body: string;
  /** So the quote can say "Photo" when there were no words. */
  hasPhoto: boolean;
  /** So the quote can say "A look" when there were no words. */
  hasSharedPost: boolean;
  /**
   * So the quote can say "A piece" when there were no words. Optional
   * because replies written before pieces could be shared do not have it.
   */
  hasSharedListing?: boolean;
}

/** The snapshot of a piece inside a message. See Message.sharedListing. */
export interface SharedListing {
  listingId: string;
  photoUrl: string | null;
  name: string;
  ownerUsername: string;
  intent: ListingIntent;
  /** The cheapest rental price at the time it was sent, if rentable. */
  rentFromCents: Cents | null;
  /** The sale price at the time it was sent, if for sale. */
  salePriceCents: Cents | null;
}
