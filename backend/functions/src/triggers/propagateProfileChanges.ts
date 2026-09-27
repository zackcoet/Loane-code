import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type User, type UserSummary } from '@loane/shared';
import { db, now } from '../lib/admin';

/**
 * Keeps the copies of a profile that live on her listings and posts in
 * step with the real thing.
 *
 * Listings and posts each carry a small snapshot of their owner — her
 * username, display name and photo — so a grid of thirty listings is one
 * read instead of thirty-one. The cost of that speed is exactly this: when
 * she changes her username, those copies go stale and her old handle
 * lingers all over the marketplace.
 *
 * This is the thing that pays that cost. It only runs when one of the
 * three copied fields actually changes, so an ordinary profile edit — a
 * new bio, a size — costs nothing.
 */

/** Firestore allows 500 writes per batch; stay under it. */
const BATCH_SIZE = 400;

export const propagateProfileChanges = onDocumentUpdated(
  { document: `${COLLECTIONS.users}/{uid}`, region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() as User | undefined;
    const after = event.data?.after.data() as User | undefined;
    if (!before || !after) return;

    const changed =
      before.username !== after.username ||
      before.displayName !== after.displayName ||
      before.photoUrl !== after.photoUrl ||
      before.isVerified !== after.isVerified;

    if (!changed) return;

    const summary: UserSummary = {
      uid: after.uid,
      username: after.username,
      displayName: after.displayName,
      photoUrl: after.photoUrl,
      campusId: after.campusId,
      isVerified: after.isVerified,
    };

    const updated = {
      listings: await rewrite(COLLECTIONS.listings, 'ownerUid', after.uid, { owner: summary }),
      posts: await rewrite(COLLECTIONS.posts, 'authorUid', after.uid, { author: summary }),
    };

    logger.info('Refreshed denormalized profile copies', { uid: after.uid, ...updated });
  },
);

/** Rewrites one field across every document owned by this user. */
async function rewrite(
  collection: string,
  ownerField: string,
  uid: string,
  patch: Record<string, unknown>,
): Promise<number> {
  const snap = await db().collection(collection).where(ownerField, '==', uid).get();
  if (snap.empty) return 0;

  let written = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db().batch();
    for (const doc of snap.docs.slice(i, i + BATCH_SIZE)) {
      batch.update(doc.ref, { ...patch, updatedAt: now() });
      written += 1;
    }
    await batch.commit();
  }
  return written;
}
