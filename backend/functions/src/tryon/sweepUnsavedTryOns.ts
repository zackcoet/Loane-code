/**
 * Unsaved try-ons are deleted after 7 days.
 *
 * A try-on she did not save is a thing she looked at once. Keeping it
 * costs storage and, far more importantly, keeps a photograph of her
 * body on our disks for no reason anybody asked for. Saved looks stay
 * until she deletes them.
 *
 * THIS NEEDS A COMPOSITE INDEX on `saved` + `createdAt`, written into
 * firestore.indexes.json in the same commit as this file. The hourly
 * booking sweep crashed on a missing index from the day it was
 * deployed and nobody noticed for weeks, because the emulator does not
 * enforce indexes and everything passed on a laptop. Do not repeat it:
 * after deploying, run the live core flow.
 *
 * NOTE FOR DEVELOPMENT: the emulator does not run scheduled functions
 * on a timer. `runTryOnSweep` does the same work and can be called by
 * an admin, which is how we test it locally.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getStorage } from 'firebase-admin/storage';
import { COLLECTIONS, type TryOn } from '@loane/shared';
import { db, Timestamp } from '../lib/admin';
import { requireAdmin } from '../lib/guards';

const KEEP_DAYS = 7;
const BATCH_SIZE = 400;

async function sweep(): Promise<{ deleted: number }> {
  const cutoff = Timestamp.fromMillis(Date.now() - KEEP_DAYS * 24 * 3600_000);

  const snap = await db()
    .collection(COLLECTIONS.tryOns)
    .where('saved', '==', false)
    .where('createdAt', '<', cutoff)
    .limit(BATCH_SIZE)
    .get();

  if (snap.empty) return { deleted: 0 };

  const bucket = getStorage().bucket();

  /**
   * A result's file may be SHARED. A preset try-on generated once for
   * the whole campus is pointed at by one document per student who
   * tried it, so deleting her row must not delete an image another
   * student's saved look still renders. Check before unlinking.
   */
  for (const doc of snap.docs) {
    const tryOn = doc.data() as TryOn;
    const others = await db()
      .collection(COLLECTIONS.tryOns)
      .where('imagePath', '==', tryOn.imagePath)
      .limit(2)
      .get();

    const onlyReference = others.docs.filter((d) => d.id !== doc.id).length === 0;
    if (onlyReference) {
      await bucket
        .file(tryOn.imagePath)
        .delete()
        .catch(() => {
          // Already gone is the outcome we wanted anyway.
        });
    }
  }

  const batch = db().batch();
  for (const doc of snap.docs) batch.delete(doc.ref);
  await batch.commit();

  logger.info('Swept unsaved try-ons', { deleted: snap.size });
  return { deleted: snap.size };
}

export const sweepUnsavedTryOns = onSchedule(
  { schedule: 'every 24 hours', region: 'us-central1' },
  async () => {
    await sweep();
  },
);

/** The same work, callable, because the emulator has no scheduler. */
export const runTryOnSweep = onCall<void, Promise<{ deleted: number }>>(
  { region: 'us-central1' },
  async (request) => {
    requireAdmin(request);
    return sweep();
  },
);
