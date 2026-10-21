/**
 * Sending looks and pieces into chats.
 *
 * Lives here rather than in the function so the function, the chat
 * screen and the tests all agree on what a shared piece looks like and
 * what the inbox says about it.
 */

import type { Listing, Message, SharedListing } from './types';

/** How much of a caption or name the snapshot keeps. */
const SNAPSHOT_TEXT_MAX = 140;

/**
 * The snapshot of a piece that goes inside the chat bubble.
 *
 * The price is the cheapest rental — the "from $X" a student scanning a
 * chat wants — and the sale price separately, so the card can show
 * whichever the piece is actually offered for.
 */
export function listingShareSnapshot(listing: Listing): SharedListing {
  const rentable = listing.intent === 'rent' || listing.intent === 'both';
  const sellable = listing.intent === 'sell' || listing.intent === 'both';
  const rentPrices = [
    listing.pricing?.oneDayCents,
    listing.pricing?.threeDayCents,
    listing.pricing?.sevenDayCents,
  ].filter((c): c is number => typeof c === 'number' && c > 0);

  return {
    listingId: listing.id,
    photoUrl: listing.coverUrl ?? listing.photos?.[0]?.url ?? null,
    name: (listing.name ?? '').slice(0, SNAPSHOT_TEXT_MAX),
    ownerUsername: listing.owner.username,
    intent: listing.intent,
    rentFromCents: rentable && rentPrices.length > 0 ? Math.min(...rentPrices) : null,
    salePriceCents: sellable ? (listing.salePriceCents ?? null) : null,
  };
}

/**
 * The one line the inbox shows for a message.
 *
 * A photo, a look or a piece sent with no words still needs a preview,
 * or the inbox row reads as an empty message.
 */
export function messagePreview(
  message: Pick<Message, 'body' | 'photo' | 'sharedPost' | 'sharedListing'>,
): string {
  if (message.body) return message.body.slice(0, SNAPSHOT_TEXT_MAX);
  if (message.sharedListing) return 'Sent a piece';
  if (message.sharedPost) return 'Sent a look';
  if (message.photo) return 'Sent a photo';
  return '';
}

/** The inbox preview when someone hearts a message, like Instagram's. */
export const LIKED_MESSAGE_PREVIEW = 'Liked a message';

/**
 * What a message reads as once an admin has taken it down, in the
 * bubble and in the inbox preview.
 */
export const REMOVED_MESSAGE_TEXT = 'Message removed by Loane';

/**
 * Whether the inbox preview is still showing this message, so taking
 * it down should replace the preview too. The preview holds a copy of
 * the words (see onMessageCreated), not a message id, so this compares
 * the copy. Getting it wrong in the rare tie (she sent the exact same
 * words twice) only means the preview says "removed" a little early.
 */
export function previewShowsMessage(
  preview: { body: string; senderUid: string } | null | undefined,
  message: Pick<Message, 'body' | 'photo' | 'sharedPost' | 'sharedListing' | 'senderUid'>,
): boolean {
  if (!preview) return false;
  return preview.senderUid === message.senderUid && preview.body === messagePreview(message);
}

/**
 * What a heart on a message should do to the inbox, if anything.
 *
 * Only a NEW heart from the other person counts — hearting your own
 * message, or taking a heart back, changes nothing. And a run of hearts
 * from the same person adds one to the badge, not one per heart, so
 * hearting and un-hearting over and over cannot pump up someone's
 * unread count.
 */
export function likeInboxUpdate(
  likedBefore: string[] | undefined,
  likedAfter: string[] | undefined,
  messageSenderUid: string,
  lastMessage: { body: string; senderUid: string } | null,
): { likerUid: string; bumpUnread: boolean } | null {
  const before = new Set(likedBefore ?? []);
  const added = (likedAfter ?? []).filter((uid) => !before.has(uid) && uid !== messageSenderUid);
  const likerUid = added[0];
  if (!likerUid) return null;
  const alreadyShowing =
    lastMessage?.body === LIKED_MESSAGE_PREVIEW && lastMessage.senderUid === likerUid;
  return { likerUid, bumpUnread: !alreadyShowing };
}
