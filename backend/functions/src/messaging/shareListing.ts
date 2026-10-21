import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, LIMITS, listingShareSnapshot, type Listing } from '@loane/shared';
import { db } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { rateLimit } from '../lib/rateLimit';
import { cleanRecipients, sendToEach } from './sendToEach';

/**
 * `shareListing`
 *
 * Sending a piece from someone's closet to friends — "would this work
 * for Saturday?". The look version is `sharePost`; this is the same
 * thing for a single garment.
 *
 * A function rather than a normal message write because the card in
 * the bubble carries a name, a photo and a price, and those have to be
 * the real listing's rather than whatever the phone claims. A forged
 * "$5 to rent" card from someone else's closet is exactly the kind of
 * thing that starts an argument at a handoff.
 *
 * No share counter on the listing yet: nothing reads one, and adding a
 * counter later is free while removing a shown one is not.
 */

interface ShareInput {
  listingId: string;
  toUids: string[];
  /** An optional line of her own, sent with it. */
  note?: string;
}

interface ShareResult {
  /** How many threads it actually landed in. */
  sentTo: number;
  /** The thread to open when she sent it to exactly one person. */
  conversationId: string | null;
}

export const shareListing = onCall<ShareInput, Promise<ShareResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<ShareInput>): Promise<ShareResult> => {
    const me = await requireVerifiedStudent(request);
    const listingId = request.data?.listingId;
    const note = typeof request.data?.note === 'string' ? request.data.note.trim() : '';
    const toUids = cleanRecipients(request.data?.toUids, me.uid);

    if (!listingId || typeof listingId !== 'string') throw invalidArgument('Which piece?');
    if (toUids.length === 0) throw invalidArgument('Pick someone to send it to.');
    if (toUids.length > LIMITS.sharePostRecipients.max) {
      throw invalidArgument(`You can send to ${LIMITS.sharePostRecipients.max} people at a time.`);
    }
    if (note.length > LIMITS.messageBody.max) throw invalidArgument('That note is too long.');
    await rateLimit(me.uid, 'share');

    const snap = await db().collection(COLLECTIONS.listings).doc(listingId).get();
    if (!snap.exists) throw notFound('That piece is gone.');
    const listing = snap.data() as Listing;
    // Paused, sold, removed or taken down: none of those should land in
    // a friend's chat looking available.
    if (listing.status !== 'active') throw failed('That piece is not available right now.');

    const { sentTo, lastConversationId } = await sendToEach(me, toUids, {
      body: note,
      sharedPost: null,
      sharedListing: listingShareSnapshot({ ...listing, id: snap.id }),
    });

    if (sentTo === 0) throw failed('We could not send that to anyone you picked.');

    logger.info('Piece shared', { listingId, sentTo });
    return { sentTo, conversationId: sentTo === 1 ? lastConversationId : null };
  },
);
