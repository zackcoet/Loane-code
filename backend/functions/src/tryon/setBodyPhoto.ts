/**
 * `setTryOnBodyPhoto`
 *
 * She uploads the photo straight to Storage — a Cloud Function has no
 * business proxying an 8MB upload, and the owner-write rule already
 * means she can only write into her own folder. This records that it
 * happened, and the consent that came with it.
 *
 * WHY A FUNCTION AND NOT AN APP WRITE. Two reasons. The `tryOn` block
 * on her private settings is outside the rules' app-writable allowlist,
 * so the app cannot touch it at all. And `selfConfirmedAt` is a record
 * of consent: if the app could write it, it could write it without ever
 * having asked.
 *
 * The path is checked against her own uid rather than trusted. The
 * Storage rule already stops her WRITING elsewhere, but nothing stops
 * her claiming a path she did not write — and a body photo pointing at
 * somebody else's file is the one thing this feature must never do.
 */

import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, SUBCOLLECTIONS, type UserPrivate } from '@loane/shared';
import { db, now } from '../lib/admin';
import { invalidArgument, failed } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { deleteTryOnFolder } from './images';

interface Input {
  /** Storage path she just uploaded to. */
  path?: string;
  /** She ticked "This is a photo of me". */
  confirmed?: boolean;
}

export const setTryOnBodyPhoto = onCall<Input, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<Input>) => {
    const me = await requireVerifiedStudent(request);
    const { path, confirmed } = request.data ?? {};

    if (!path) throw invalidArgument('No photo to save.');

    // NOT a trusted field. See the header.
    const expected = `users/${me.uid}/tryon/body/`;
    if (!path.startsWith(expected) || path.includes('..')) {
      logger.warn('Rejected a try-on body path outside her own folder', { uid: me.uid });
      throw failed('That photo could not be saved.');
    }

    // The confirmation is the whole basis on which we hold a photograph
    // of somebody's body. Without it there is nothing to record.
    if (confirmed !== true) throw failed('Confirm the photo is of you.');

    const ref = db()
      .collection(COLLECTIONS.users)
      .doc(me.uid)
      .collection(SUBCOLLECTIONS.userPrivate)
      .doc('settings');

    const snap = await ref.get();
    const existing = (snap.data() as UserPrivate | undefined)?.tryOn;

    await ref.set(
      {
        tryOn: {
          ...(existing ?? {}),
          bodyPhotoPath: path,
          bodyPhotoUploadedAt: now(),
          selfConfirmedAt: now(),
        },
        updatedAt: now(),
      },
      { merge: true },
    );

    logger.info('Try-on body photo set', { uid: me.uid });
    return { ok: true };
  },
);

/**
 * `clearTryOnBodyPhoto` — retake, or simply remove.
 *
 * Deletes the FILES, not just the pointer. A retake that left the old
 * photograph on our disks would be a retake in name only.
 *
 * Her saved looks are left alone: they are pictures she chose to keep,
 * and Settings has a separate one-tap delete for everything.
 */
export const clearTryOnBodyPhoto = onCall<void, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const me = await requireVerifiedStudent(request);
    await deleteTryOnFolder(me.uid, 'body');

    await db()
      .collection(COLLECTIONS.users)
      .doc(me.uid)
      .collection(SUBCOLLECTIONS.userPrivate)
      .doc('settings')
      .set(
        {
          tryOn: { bodyPhotoPath: null, bodyPhotoUploadedAt: null, selfConfirmedAt: null },
          updatedAt: now(),
        },
        { merge: true },
      );

    logger.info('Try-on body photo cleared', { uid: me.uid });
    return { ok: true };
  },
);
