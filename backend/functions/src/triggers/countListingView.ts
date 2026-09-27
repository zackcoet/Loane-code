import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type AppEvent, type Listing } from '@loane/shared';
import { db, FieldValue } from '../lib/admin';

/**
 * Keeps `listing.stats.viewCount` moving.
 *
 * The app already logs a `listing_view` event when someone opens a piece,
 * but it cannot write the counter — the security rules forbid it, because
 * a view count anyone can edit is not a number worth showing an owner.
 * So we watch the event stream instead and do the increment here.
 *
 * Two deliberate rules:
 *
 *   - Your own views do not count. An owner checking her own listing
 *     should not inflate it.
 *   - Repeat views by the same person DO count, for now. Deduplicating
 *     needs a record per viewer per listing, which is a write of its own
 *     on every view. Worth doing when the number starts driving
 *     decisions; not worth it today. Noted in docs/roadmap.md.
 */

export const countListingView = onDocumentCreated(
  { document: `${COLLECTIONS.events}/{eventId}`, region: 'us-central1' },
  async (event) => {
    const data = event.data?.data() as AppEvent | undefined;
    if (!data || data.type !== 'listing_view') return;

    const listingId = data.targetId;
    if (!listingId) return;

    const ref = db().collection(COLLECTIONS.listings).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) return;

    // An owner looking at her own piece is not a view.
    if ((snap.data() as Listing).ownerUid === data.uid) return;

    await ref.update({ 'stats.viewCount': FieldValue.increment(1) });
    logger.debug('Counted a listing view', { listingId });
  },
);
