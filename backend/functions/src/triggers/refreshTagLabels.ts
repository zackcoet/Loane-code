import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type Listing, type Post, type PostPhoto } from '@loane/shared';
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

const BATCH_SIZE = 400;

export const refreshTagLabels = onDocumentUpdated(
  { document: `${COLLECTIONS.listings}/{listingId}`, region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() as Listing | undefined;
    const after = event.data?.after.data() as Listing | undefined;
    if (!before || !after) return;

    const changed =
      before.name !== after.name ||
      before.coverUrl !== after.coverUrl ||
      before.pricing.threeDayCents !== after.pricing.threeDayCents ||
      before.salePriceCents !== after.salePriceCents ||
      before.owner.username !== after.owner.username;

    if (!changed) return;

    const listingId = event.params.listingId;
    const label = {
      name: after.name,
      coverUrl: after.coverUrl,
      priceCents3Day: after.pricing.threeDayCents,
      salePriceCents: after.salePriceCents,
      ownerUsername: after.owner.username,
    };

    const snap = await db()
      .collection(COLLECTIONS.posts)
      .where('taggedListingIds', 'array-contains', listingId)
      .get();

    if (snap.empty) return;

    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = db().batch();
      for (const doc of snap.docs.slice(i, i + BATCH_SIZE)) {
        const post = doc.data() as Post;

        const photos: PostPhoto[] = (post.photos ?? []).map((photo) => ({
          ...photo,
          tags: (photo.tags ?? []).map((tag) =>
            tag.listingId === listingId ? { ...tag, label } : tag,
          ),
        }));

        // The summary row under the photo carries its own copy.
        const taggedListings = (post.taggedListings ?? []).map((summary) =>
          summary.listingId === listingId
            ? {
                ...summary,
                name: after.name,
                coverUrl: after.coverUrl,
                priceCents3Day: after.pricing.threeDayCents,
                salePriceCents: after.salePriceCents,
              }
            : summary,
        );

        batch.update(doc.ref, { photos, taggedListings, updatedAt: now() });
      }
      await batch.commit();
    }

    logger.info('Refreshed tag labels', { listingId, posts: snap.size });
  },
);
