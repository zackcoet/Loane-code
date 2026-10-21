import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { COLLECTIONS, type Listing, type User } from '@loane/shared';
import { db } from '../lib/admin';
import { queueAutoFlag } from '../moderation/autoFlag';
import { changedText } from '../moderation/changedText';

/**
 * Runs the content filter over the two kinds of text the app saves
 * directly rather than through a function: a piece's name and
 * description, and her display name and bio (server-side audit, rows 5
 * and 7).
 *
 * Like flagEditedCaption, a match never blocks the save. It files a
 * report in the admin queue for a person to judge. The event id is part
 * of the report id, so a retried run files the same report rather than a
 * second one, while a later edit gets a report of its own.
 */

export const flagListingText = onDocumentWritten(
  { document: `${COLLECTIONS.listings}/{listingId}`, region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() as Listing | undefined;
    const after = event.data?.after.data() as Listing | undefined;
    if (!after) return; // deleted
    const text = changedText(before, after, ['name', 'description']);
    if (!text) return;

    const batch = db().batch();
    const flagged = queueAutoFlag(batch, {
      targetType: 'listing',
      targetId: event.params.listingId,
      targetUid: after.ownerUid,
      campusId: after.campusId,
      text,
      idSuffix: `edit_${event.id}`,
    });
    if (flagged) await batch.commit();
  },
);

export const flagProfileText = onDocumentUpdated(
  { document: `${COLLECTIONS.users}/{uid}`, region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() as User | undefined;
    const after = event.data?.after.data() as User | undefined;
    if (!before || !after) return;
    // Profiles are created by createAccount from her signup answers, so
    // only edits reach here; a new account's name is checked on its first edit.
    const text = changedText(before, after, ['displayName', 'bio']);
    if (!text) return;

    const batch = db().batch();
    const flagged = queueAutoFlag(batch, {
      targetType: 'user',
      targetId: event.params.uid,
      targetUid: event.params.uid,
      campusId: after.campusId,
      text,
      idSuffix: `edit_${event.id}`,
    });
    if (flagged) await batch.commit();
  },
);
