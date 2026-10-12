/**
 * "Which of my contacts are already on Loane?"
 *
 * WHAT LEAVES THE PHONE: a SHA-256 of each contact's phone number,
 * and nothing else. No names, no emails, no photos, no raw numbers,
 * not even a count of how many contacts she has that we failed to
 * parse. The hashing happens here, on her device, before anything is
 * sent.
 *
 * WHAT IS KEPT: nothing. Not on the phone, not on the server. The
 * matches live in this hook's state until she leaves the screen, and
 * the server compares the hashes and drops them — see
 * backend/functions/src/social/matchContacts.ts. Reopening the screen
 * reads her address book again rather than showing a stored copy,
 * which is slower and is the point.
 *
 * Her address book is other people's personal data. She can consent to
 * us looking at it; she cannot consent on their behalf to us keeping
 * it.
 */

import { useCallback, useState } from 'react';
import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { normalizePhone } from '@loane/shared';
import { matchContacts, type ContactMatch } from '../firebase/callables';
import { callableErrorMessage } from '../firebase/errors';

/** Matches the cap the Cloud Function enforces. */
const HASHES_PER_CALL = 500;

/**
 * A ceiling on how much of a very large address book we look at.
 *
 * Someone with 8,000 contacts is almost always carrying a synced work
 * directory, and walking all of it would be slow for a result she does
 * not want. Her actual friends are not at position 6,000.
 */
const MAX_CONTACTS = 3000;

export type ContactsState =
  | 'idle'
  | 'asking'
  | 'denied'
  | 'working'
  | 'done'
  | 'error';

export function useContactMatches() {
  const [state, setState] = useState<ContactsState>('idle');
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setError(null);
    setState('asking');

    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        // Not an error. She said no, which is an answer.
        setState('denied');
        return;
      }

      setState('working');

      // Only the phone numbers field. Asking for names we are not going
      // to use would be collecting them for no reason.
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      const e164 = new Set<string>();
      for (const contact of data.slice(0, MAX_CONTACTS)) {
        for (const number of contact.phoneNumbers ?? []) {
          const normalized = normalizePhone(number.number ?? '');
          // +1 and ten digits. Anything shorter is a short code or a
          // half-saved number and will never match anybody.
          if (normalized.length >= 11) e164.add(normalized);
        }
      }

      if (e164.size === 0) {
        setMatches([]);
        setState('done');
        return;
      }

      const hashes = await Promise.all(
        [...e164].map((number) =>
          Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, number),
        ),
      );

      // In batches, because one enormous request is the shape that
      // falls over in production.
      const found: ContactMatch[] = [];
      for (let i = 0; i < hashes.length; i += HASHES_PER_CALL) {
        const result = await matchContacts({ hashes: hashes.slice(i, i + HASHES_PER_CALL) });
        found.push(...result.data.matches);
      }

      // One card per person, however many of their numbers she has.
      const seen = new Set<string>();
      setMatches(found.filter((m) => (seen.has(m.uid) ? false : seen.add(m.uid))));
      setState('done');
    } catch (err) {
      setError(callableErrorMessage(err, 'Could not check your contacts. Try again.'));
      setState('error');
    }
  }, []);

  /** Drop a card once she has followed them, so the list stays live. */
  const markFollowed = useCallback((uid: string) => {
    setMatches((current) =>
      current.map((m) => (m.uid === uid ? { ...m, isFollowing: true } : m)),
    );
  }, []);

  return { state, matches, error, run, markFollowed };
}
