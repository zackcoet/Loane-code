import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  isTryOnReady,
  type Listing,
  type PhotoTag,
  type Post,
  type PostPhoto,
} from '@loane/shared';
import { db, now } from '../lib/admin';

/**
 * Keeps the tag labels stored on posts in step with the listing itself.
 *
 * Every tag carries a snapshot of the item name and price so that tapping
 * a photo renders instantly instead of firing one read per tag. The cost
 * of that speed is staleness: change a price, and every post that tagged
 * the piece still shows the old one.
 *
 * This is the thing that pays that cost. docs/post-tagging.md said a
 * function could do it "if it becomes a real problem" — it is cheap
 * enough to just do, and it only runs when a name or price actually
 * changes, so an ordinary listing edit costs nothing.
 */

export const refreshTagLabels = onDocumentUpdated(
  { document: `${COLLECTIONS.listings}/{listingId}`, region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() as Listing | undefined;
    const after = event.data?.after.data() as Listing | undefined;
    if (!before || !after) return;

    const changed =
      before.name !== after.name ||
      before.coverUrl !== after.coverUrl ||
      before.pricing?.threeDayCents !== after.pricing?.threeDayCents ||
      before.salePriceCents !== after.salePriceCents ||
      before.owner.username !== after.owner.username ||
      /*
        Try-on readiness. A lender attaching a lay-it-flat photo months
        after posting a look should make "Try this look on" appear on
        that post — and removing the photo, or the listing changing to
        a category we cannot do, should take it away again.
      */
      isTryOnReady(before) !== isTryOnReady(after);

    if (!changed) return;

    const listingId = event.params.listingId;

    /*
      THE PIECE AS IT IS NOW, not as this event remembers it. Change a
      price twice in a row and two runs of this job start at once, in no
      guaranteed order; copying the event's own version let the older
      price win and stay on every look. Reading fresh, both write the
      newest.
    */
    const fresh = await db().collection(COLLECTIONS.listings).doc(listingId).get();
    if (!fresh.exists) return;
    const label = labelOf(fresh.data() as Listing);

    // index-check: one array-contains filter and no sort — no index needed.
    const snap = await db()
      .collection(COLLECTIONS.posts)
      .where('taggedListingIds', 'array-contains', listingId)
      .get();
    if (snap.empty) return;

    /*
      ONE LOOK AT A TIME, each in its own transaction. This rewrites a
      look's whole list of photos, so writing from a copy read a moment
      earlier could undo an edit she made to that look in between — a
      tag she moved, a photo she removed. And a look deleted meanwhile
      is simply skipped, where in a shared batch it failed the update to
      every other look beside it.
    */
    let refreshed = 0;
    for (const doc of snap.docs) {
      const done = await db().runTransaction(async (tx) => {
        const current = await tx.get(doc.ref);
        if (!current.exists) return false;
        const patch = relabelPost(current.data() as Post, listingId, label);
        if (!patch) return false;
        tx.update(doc.ref, { ...patch, updatedAt: now() });
        return true;
      });
      if (done) refreshed += 1;
    }

    logger.info('Refreshed tag labels', { listingId, posts: refreshed });
  },
);

type TagLabel = PhotoTag['label'];

/** What a tag on a look shows for this piece. */
export function labelOf(listing: Listing): TagLabel {
  return {
    name: listing.name,
    coverUrl: listing.coverUrl,
    priceCents3Day: listing.pricing?.threeDayCents ?? null,
    salePriceCents: listing.salePriceCents ?? null,
    ownerUsername: listing.owner.username,
    tryOnReady: isTryOnReady(listing),
  };
}

/**
 * The look's photos and summary row with this piece's label swapped in,
 * or null when the look no longer tags it (she edited it out since).
 */
export function relabelPost(
  post: Post,
  listingId: string,
  label: TagLabel,
): Pick<Post, 'photos' | 'taggedListings'> | null {
  if (!(post.taggedListingIds ?? []).includes(listingId)) return null;

  const photos: PostPhoto[] = (post.photos ?? []).map((photo) => ({
    ...photo,
    tags: (photo.tags ?? []).map((tag) => (tag.listingId === listingId ? { ...tag, label } : tag)),
  }));

  // The summary row under the photo carries its own copy.
  const taggedListings = (post.taggedListings ?? []).map((summary) =>
    summary.listingId === listingId
      ? {
          ...summary,
          name: label.name,
          coverUrl: label.coverUrl,
          priceCents3Day: label.priceCents3Day,
          salePriceCents: label.salePriceCents,
        }
      : summary,
  );

  return { photos, taggedListings };
}
