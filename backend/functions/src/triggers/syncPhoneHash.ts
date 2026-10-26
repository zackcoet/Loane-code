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
 * phone number lives. Added, changed, removed or deleted, it ends the
 * same way: she holds the hash of the number saved NOW, and no other.
 *
 * WHAT THE EVENT IS NOT TRUSTED FOR. Two quick edits fire two events
 * that can run in either order. Writing "the event's new number" would
 * let the older event finish last and leave her matched by a number she
 * has already replaced. So the transaction re-reads her settings and
 * works from the number saved now; the event only says which old
 * numbers to let go of.
 *
 * WHO ELSE HOLDS IT. A number two accounts have both saved matches
 * neither (lib/phoneHolders.ts), and letting go of a number only takes
 * HER off it — before, it deleted the hash even if someone else held it.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { COLLECTIONS, SUBCOLLECTIONS, type UserPrivate } from '@loane/shared';
import { db, now } from '../lib/admin';
import { CONTACT_MATCH_PEPPER, storedPhoneHashFromE164 } from '../lib/phoneHash';
import { holdersOf, rowFor, type PhoneHashRow } from '../lib/phoneHolders';

function phoneOf(row: UserPrivate | undefined): string | null {
  const phone = row?.phone;
  return typeof phone === 'string' && phone !== '' ? phone : null;
}

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
    const before = phoneOf(event.data?.before.data() as UserPrivate | undefined);
    const after = phoneOf(event.data?.after.data() as UserPrivate | undefined);
    if (before === after) return;

    const settingsRef = db()
      .collection(COLLECTIONS.users)
      .doc(uid)
      .collection(SUBCOLLECTIONS.userPrivate)
      .doc('settings');
    const hashes = db().collection(COLLECTIONS.phoneHashes);

    const hasPhone = await db().runTransaction(async (tx) => {
      const current = phoneOf((await tx.get(settingsRef)).data() as UserPrivate | undefined);

      // Hash id → whether she should hold it. Every number this event
      // mentions that is not her current one is let go of.
      const want = new Map<string, boolean>();
      for (const phone of [before, after]) {
        if (phone && phone !== current) want.set(storedPhoneHashFromE164(phone), false);
      }
      if (current) want.set(storedPhoneHashFromE164(current), true);

      const ids = [...want.keys()];
      const rows = await Promise.all(ids.map((id) => tx.get(hashes.doc(id))));

      rows.forEach((snap, i) => {
        const ref = hashes.doc(ids[i]!);
        const held = holdersOf(snap.data() as PhoneHashRow | undefined);
        const keep = want.get(ids[i]!)!;
        if (held.includes(uid) === keep) return; // already right

        const next = rowFor(keep ? [...held, uid] : held.filter((u) => u !== uid));
        if (!next) tx.delete(ref);
        else if (snap.exists) tx.update(ref, { ...next, updatedAt: now() });
        else tx.set(ref, { ...next, createdAt: now(), updatedAt: now() });
      });
      return current !== null;
    });

    // The number itself is never logged. Whether somebody has one is
    // not sensitive; what it is, is.
    logger.info('Phone hash synced', { uid, hasPhone });
  },
);
