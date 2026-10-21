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
