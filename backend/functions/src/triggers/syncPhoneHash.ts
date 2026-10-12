/**
 * Keeps `phoneHashes` in step with the phone numbers students have
 * saved.
 *
 * WHY A TRIGGER AND NOT THE APP. Two reasons, and either on its own
 * would be enough. The pepper is a server secret, so the app cannot
 * compute the stored hash even if we trusted it to. And a document
 * that says "this hash is uid X" is a claim about identity — if the
 * app could write it, a student could point somebody else's phone
 * number at her own account and be matched by all of their friends.
 *
 * It fires on her private settings document, which is the only place a
 * phone number lives. Every path through it is covered:
 *
 *   added    — write the hash
 *   changed  — delete the old one, write the new one
 *   removed  — delete the hash, and she stops matching immediately
 *   deleted  — same as removed
 *
 * The old hash is deleted BEFORE the new one is written, so a number
 * moving between two accounts can never leave both pointing at it.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { COLLECTIONS, SUBCOLLECTIONS, type UserPrivate } from '@loane/shared';
import { db, now } from '../lib/admin';
import { CONTACT_MATCH_PEPPER, storedPhoneHashFromE164 } from '../lib/phoneHash';

export const syncPhoneHash = onDocumentWritten(
  {
    document: `${COLLECTIONS.users}/{uid}/${SUBCOLLECTIONS.userPrivate}/{docId}`,
    region: 'us-central1',
    secrets: [CONTACT_MATCH_PEPPER],
  },
  async (event) => {
    // The private subcollection holds exactly one document today, but
    // the wildcard would match a second one if anybody added it.
    if (event.params.docId !== 'settings') return;

    const uid = event.params.uid;
    const before = event.data?.before.data() as UserPrivate | undefined;
    const after = event.data?.after.data() as UserPrivate | undefined;

    const oldPhone = before?.phone ?? null;
    const newPhone = after?.phone ?? null;
    if (oldPhone === newPhone) return;

    const hashes = db().collection(COLLECTIONS.phoneHashes);

    if (oldPhone) {
      await hashes.doc(storedPhoneHashFromE164(oldPhone)).delete();
    }

    if (newPhone) {
      await hashes.doc(storedPhoneHashFromE164(newPhone)).set({
        uid,
        createdAt: now(),
      });
    }

    // The number itself is never logged. Whether somebody has one is
    // not sensitive; what it is, is.
    logger.info('Phone hash synced', { uid, hasPhone: Boolean(newPhone) });
  },
);
