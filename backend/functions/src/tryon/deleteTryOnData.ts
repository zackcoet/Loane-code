/**
 * `deleteTryOnData`
 *
 * One tap from Settings. Her body photo, every try-on document she
 * owns, every result file, and the consent record — gone.
 *
 * NO ARGUMENTS AND NO CONFIRMATION BEYOND THE TAP. She should never
 * have to fight for this, and a function that takes a "confirm: true"
 * is a function that can be made to ask twice.
 *
 * Deletes the FILES FIRST. If this fails halfway, the thing left behind
 * must be a row pointing at nothing, never an image pointing at
 * nobody — one is tidy-up, the other is a photograph of her we still
 * hold and no longer have a record of.
 */

import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, SUBCOLLECTIONS } from '@loane/shared';
import { db, now } from '../lib/admin';
import { requireActiveUser } from '../lib/guards';
import { deleteTryOnFolder } from './images';

/** Firestore allows 500 writes per batch; stay under it. */
const BATCH_SIZE = 400;

export const deleteTryOnData = onCall<void, Promise<{ deleted: number }>>(
  { region: 'us-central1' },
  async (request) => {
    const me = await requireActiveUser(request);

    // Files first. See the header for why the order is not arbitrary.
    await deleteTryOnFolder(me.uid, 'results');
    await deleteTryOnFolder(me.uid, 'body');

    const snap = await db().collection(COLLECTIONS.tryOns).where('uid', '==', me.uid).get();

    let deleted = 0;
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = db().batch();
      for (const doc of snap.docs.slice(i, i + BATCH_SIZE)) {
        batch.delete(doc.ref);
        deleted += 1;
      }
      await batch.commit();
    }

    // The consent record goes with the photo it was consent for. The
    // usage count does NOT reset — deleting her photos is a privacy
    // action, not a way to refill a free allowance.
    await db()
      .collection(COLLECTIONS.users)
      .doc(me.uid)
      .collection(SUBCOLLECTIONS.userPrivate)
      .doc('settings')
      .set(
        {
          tryOn: {
            bodyPhotoPath: null,
            bodyPhotoUploadedAt: null,
            selfConfirmedAt: null,
          },
          updatedAt: now(),
        },
        { merge: true },
      );

    logger.info('Try-on data deleted', { uid: me.uid, documents: deleted });
    return { deleted };
  },
);
