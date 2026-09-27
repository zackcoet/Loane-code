import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTIONS, ids, type Listing, type Save } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { invalidArgument, notFound } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';

/**
 * `saveListing` and `unsaveListing`.
 *
 * Saving drives `listing.stats.saveCount`, which owners see and which will
 * eventually feed recommendations — so, like follows and likes, the app is
 * not allowed to write it. The security rules refuse direct writes to the
 * `saves` collection entirely.
 *
 * The document id is `{uid}_{listingId}`, so saving twice is impossible by
 * construction. The transaction only moves the counter when the save
 * actually changes, which keeps a double tap from counting twice.
 */

interface SaveInput {
  listingId: string;
}

interface SaveResult {
  saved: boolean;
}

async function setSaved(
  request: CallableRequest<SaveInput>,
  shouldSave: boolean,
): Promise<SaveResult> {
  const user = await requireActiveUser(request);
  const listingId = request.data?.listingId;
  if (!listingId) throw invalidArgument('Which piece do you want to save?');

  const listingRef = db().collection(COLLECTIONS.listings).doc(listingId);
  const saveRef = db().collection(COLLECTIONS.saves).doc(ids.save(user.uid, listingId));

  await db().runTransaction(async (tx) => {
    const [listingSnap, saveSnap] = await Promise.all([tx.get(listingRef), tx.get(saveRef)]);
    if (!listingSnap.exists) throw notFound('That piece is no longer listed.');

    const alreadySaved = saveSnap.exists;
    if (alreadySaved === shouldSave) return;

    if (shouldSave) {
      const listing = listingSnap.data() as Listing;
      const save: Save = {
        id: saveRef.id,
        uid: user.uid,
        listingId,
        campusId: listing.campusId,
        createdAt: now() as never,
      };
      tx.set(saveRef, save);
      tx.update(listingRef, { 'stats.saveCount': FieldValue.increment(1) });
    } else {
      tx.delete(saveRef);
      tx.update(listingRef, { 'stats.saveCount': FieldValue.increment(-1) });
    }
  });

  return { saved: shouldSave };
}

export const saveListing = onCall<SaveInput, Promise<SaveResult>>({ region: 'us-central1' }, (r) =>
  setSaved(r, true),
);

export const unsaveListing = onCall<SaveInput, Promise<SaveResult>>(
  { region: 'us-central1' },
  (r) => setSaved(r, false),
);
