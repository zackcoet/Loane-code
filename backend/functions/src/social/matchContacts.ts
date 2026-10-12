/**
 * `matchContacts`
 *
 * "Which of the people in my phone are already on Loane?"
 *
 * THE REQUEST IS NEVER WRITTEN DOWN. Not to Firestore, not to the
 * event log, not to a function log. The hashes arrive, they are
 * compared against `phoneHashes`, the matches come back, and the
 * request is gone when the function returns. There is no code path
 * here that persists anything derived from her address book, and that
 * is the whole privacy promise of the feature — see
 * docs/decisions.md.
 *
 * The app sends SHA-256 of each number and never the numbers
 * themselves, nor names, nor emails. lib/phoneHash.ts is precise about
 * what that does and does not protect.
 *
 * WHAT COMES BACK is a UserSummary — the same public card shown
 * everywhere else in the app. It deliberately does NOT say which
 * contact matched which account: she can see that Anna is on Loane,
 * not that the number she has for Anna is the one Anna signed up
 * with. The difference matters for anybody who has a second number
 * they have not given out.
 *
 * SAME CAMPUS ONLY. Partly because that is how the rest of Loane
 * works, partly because a cross-campus match tells her something
 * about a person she could not otherwise learn, and USC is the only
 * campus live anyway.
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTIONS, type User, type UserSummary } from '@loane/shared';
import { db } from '../lib/admin';
import { requireVerifiedStudent } from '../lib/guards';
import { CONTACT_MATCH_PEPPER, storedPhoneHash } from '../lib/phoneHash';

/**
 * How many hashes one call may carry.
 *
 * An address book of a few thousand is normal, so the app splits it
 * into calls of this size rather than us raising the cap — a single
 * enormous request is the shape that falls over in production.
 */
const MAX_HASHES_PER_CALL = 500;

/** Firestore `getAll` is happy with this many document refs at once. */
const LOOKUP_CHUNK = 200;

interface Input {
  /** Hex SHA-256 of each contact's E.164 number. */
  hashes?: string[];
}

export interface ContactMatch extends UserSummary {
  /** Whether she already follows them, so the button says the truth. */
  isFollowing: boolean;
}

function summarize(user: User): UserSummary {
  return {
    uid: user.uid,
    username: user.username,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    campusId: user.campusId,
    isVerified: user.isVerified,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const matchContacts = onCall<Input, Promise<{ matches: ContactMatch[] }>>(
  { region: 'us-central1', secrets: [CONTACT_MATCH_PEPPER] },
  async (request: CallableRequest<Input>) => {
    const me = await requireVerifiedStudent(request);

    const incoming = request.data?.hashes ?? [];
    if (!Array.isArray(incoming)) {
      throw new HttpsError('invalid-argument', 'hashes must be a list.');
    }
    if (incoming.length > MAX_HASHES_PER_CALL) {
      throw new HttpsError(
        'invalid-argument',
        `Send at most ${MAX_HASHES_PER_CALL} at a time.`,
      );
    }

    // Shape-check before hashing: a 64-character hex string is the only
    // thing the app should ever send, and anything else is either a bug
    // or somebody poking at the endpoint.
    const clean = [...new Set(incoming.filter((h) => /^[0-9a-f]{64}$/.test(h)))];
    if (clean.length === 0) return { matches: [] };

    // --- Hash lookup ------------------------------------------------------
    const hashes = db().collection(COLLECTIONS.phoneHashes);
    const uids = new Set<string>();

    for (const group of chunk(clean, LOOKUP_CHUNK)) {
      const refs = group.map((h) => hashes.doc(storedPhoneHash(h)));
      const docs = await db().getAll(...refs);
      for (const doc of docs) {
        const uid = doc.get('uid') as string | undefined;
        // Herself, obviously. Her own number is in plenty of address
        // books, including her own.
        if (uid && uid !== me.uid) uids.add(uid);
      }
    }

    if (uids.size === 0) return { matches: [] };

    // --- The people behind them -------------------------------------------
    const [userDocs, followingSnap, blockedSnap] = await Promise.all([
      db().getAll(...[...uids].map((uid) => db().collection(COLLECTIONS.users).doc(uid))),
      db().collection(COLLECTIONS.follows).where('followerUid', '==', me.uid).get(),
      db().collection(COLLECTIONS.users).doc(me.uid).collection('blocked').get(),
    ]);

    const following = new Set(followingSnap.docs.map((d) => d.get('followingUid') as string));
    const blocked = new Set(blockedSnap.docs.map((d) => d.id));

    const matches: ContactMatch[] = [];
    for (const doc of userDocs) {
      if (!doc.exists) continue;
      const user = doc.data() as User;

      if (blocked.has(user.uid)) continue;
      if (user.status !== 'active') continue;
      // See the header: cross-campus matches are deliberately not shown.
      if (user.campusId !== me.campusId) continue;

      matches.push({ ...summarize(user), isFollowing: following.has(user.uid) });
    }

    // People she does not follow yet first — they are the reason she
    // opened this screen.
    matches.sort((a, b) => {
      if (a.isFollowing !== b.isFollowing) return a.isFollowing ? 1 : -1;
      return a.displayName.localeCompare(b.displayName);
    });

    return { matches };
  },
);
