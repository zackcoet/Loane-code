import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { COLLECTIONS, SUBCOLLECTIONS, type User, type UserSummary } from '@loane/shared';
import { db } from '../lib/admin';
import { requireVerifiedStudent } from '../lib/guards';

/**
 * `suggestedClosets`
 *
 * Who to follow, ranked by how many closets she and they both follow.
 *
 * THIS EXISTS SO THAT WHO-FOLLOWS-WHOM STAYS PRIVATE. Ranking by mutual
 * follows needs to read other students' following lists, and opening
 * that to the app would mean any signed-in student could enumerate the
 * entire social graph of her campus. The count is the only part she
 * needs — "12 mutuals" is a number, not a list — so the graph is read
 * here, on a server she cannot edit, and only the number comes back.
 *
 * HOW THE RANKING WORKS. Rather than scoring every student on campus,
 * it walks outward: the people SHE follows, then the people THEY
 * follow. A candidate's mutual count falls out of that walk as a tally
 * rather than needing a query of its own, and anyone with a mutual
 * follow is in the set by construction.
 *
 * Friends-of-friends usually runs dry on a new campus, so the list is
 * topped up with the most-followed closets at her school. Those have a
 * mutual count of zero and the app says nothing rather than "0 mutuals".
 */

/** Firestore's `in` operator takes at most 30 values. */
const IN_CHUNK = 30;

export interface SuggestedCloset extends UserSummary {
  /** Closets she and this person both follow. Zero when unknown. */
  mutualCount: number;
  followerCount: number;
}

interface Input {
  /** How many to return. Capped, because this is a feed row. */
  limit?: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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

export const suggestedClosets = onCall<Input, Promise<{ closets: SuggestedCloset[] }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<Input>) => {
    const me = await requireVerifiedStudent(request);
    const limit = Math.min(Math.max(request.data?.limit ?? 10, 1), 20);

    // --- Who she already follows, and who she will never be shown ------
    const [followingSnap, blockedSnap, dismissedSnap] = await Promise.all([
      db().collection(COLLECTIONS.follows).where('followerUid', '==', me.uid).get(),
      db().collection(COLLECTIONS.users).doc(me.uid).collection(SUBCOLLECTIONS.userBlocked).get(),
      db()
        .collection(COLLECTIONS.users)
        .doc(me.uid)
        .collection(SUBCOLLECTIONS.userDismissedSuggestions)
        .get(),
    ]);

    const following = followingSnap.docs.map((d) => d.get('followingUid') as string);
    const excluded = new Set<string>([
      me.uid,
      ...following,
      ...blockedSnap.docs.map((d) => d.id),
      ...dismissedSnap.docs.map((d) => d.id),
    ]);

    // --- Friends of friends, tallied ------------------------------------
    const mutuals = new Map<string, number>();
    if (following.length > 0) {
      const batches = await Promise.all(
        chunk(following, IN_CHUNK).map((group) =>
          db().collection(COLLECTIONS.follows).where('followerUid', 'in', group).get(),
        ),
      );
      for (const snap of batches) {
        for (const doc of snap.docs) {
          const candidate = doc.get('followingUid') as string;
          if (excluded.has(candidate)) continue;
          mutuals.set(candidate, (mutuals.get(candidate) ?? 0) + 1);
        }
      }
    }

    const ranked = [...mutuals.entries()].sort((a, b) => b[1] - a[1]).map(([uid]) => uid);

    // --- Top up with the busiest closets on her campus -------------------
    //
    // Over-fetch, because some of what comes back is already excluded or
    // already ranked, and a short row looks broken.
    let candidates = ranked.slice(0, limit);
    if (candidates.length < limit) {
      const popular = await db()
        .collection(COLLECTIONS.users)
        .where('campusId', '==', me.campusId)
        .where('status', '==', 'active')
        .orderBy('stats.followerCount', 'desc')
        .limit(limit * 3)
        .get();

      const seen = new Set(candidates);
      for (const doc of popular.docs) {
        if (candidates.length >= limit) break;
        if (excluded.has(doc.id) || seen.has(doc.id)) continue;
        seen.add(doc.id);
        candidates.push(doc.id);
      }
    }
    candidates = candidates.slice(0, limit);
    if (candidates.length === 0) return { closets: [] };

    // --- Hydrate, and drop anyone who has blocked HER --------------------
    //
    // Her own block list was handled above. This is the other direction,
    // and it cannot be a query, so it is a read per candidate — which is
    // why the list is capped at 20.
    const [users, blockedBy] = await Promise.all([
      db().getAll(...candidates.map((uid) => db().collection(COLLECTIONS.users).doc(uid))),
      Promise.all(
        candidates.map((uid) =>
          db()
            .collection(COLLECTIONS.users)
            .doc(uid)
            .collection(SUBCOLLECTIONS.userBlocked)
            .doc(me.uid)
            .get(),
        ),
      ),
    ]);

    const closets: SuggestedCloset[] = [];
    users.forEach((snap, index) => {
      if (!snap.exists || blockedBy[index]?.exists) return;
      const user = snap.data() as User;
      if (user.status !== 'active') return;
      closets.push({
        ...summarize(user),
        mutualCount: mutuals.get(snap.id) ?? 0,
        followerCount: user.stats?.followerCount ?? 0,
      });
    });

    return { closets };
  },
);
