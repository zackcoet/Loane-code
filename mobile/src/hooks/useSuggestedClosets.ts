/**
 * Closets to follow, from the `suggestedClosets` function.
 *
 * The ranking and the mutual counts are computed server-side on
 * purpose — see the function for why — so this hook is deliberately
 * thin. It fetches once per feed session rather than on every render:
 * a row that reshuffles while she is scrolling past it is worse than
 * one that is slightly stale.
 *
 * Following and dismissing both remove a card locally and immediately.
 * Waiting on a round trip to make a card disappear after she tapped X
 * is the kind of lag that makes an app feel broken, and neither action
 * is one she can get wrong.
 */

import { useCallback, useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { COLLECTIONS, SUBCOLLECTIONS, type UserSummary } from '@loane/shared';
import { db } from '../firebase/config';
import { followUser, suggestedClosets } from '../firebase/callables';
import { useAuth } from '../auth/AuthProvider';

export interface SuggestedCloset extends UserSummary {
  mutualCount: number;
  followerCount: number;
}

export function useSuggestedClosets(limit = 10) {
  const { profile } = useAuth();
  const [closets, setClosets] = useState<SuggestedCloset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    suggestedClosets({ limit })
      .then((result) => {
        if (!cancelled) setClosets(result.data.closets);
      })
      .catch((error) => {
        // A suggestion row that fails is not worth an error message.
        // She came here to read her feed. It IS worth a log line.
        console.warn('[Loane] suggestedClosets failed', error);
        if (!cancelled) setClosets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Once per sign-in, not once per render.
  }, [profile?.uid, limit]);

  const remove = useCallback((uid: string) => {
    setClosets((current) => current.filter((c) => c.uid !== uid));
  }, []);

  const follow = useCallback(
    async (uid: string) => {
      remove(uid);
      try {
        await followUser({ uid });
      } catch {
        // The card is already gone. Putting it back after a failed
        // follow would be more confusing than leaving it hidden; she
        // can find the closet again from Discover.
      }
    },
    [remove],
  );

  const dismiss = useCallback(
    async (uid: string) => {
      remove(uid);
      if (!profile) return;
      // Written straight from the app: it moves no counter and changes
      // only what she is shown. See the rule in firestore.rules.
      await setDoc(
        doc(db, COLLECTIONS.users, profile.uid, SUBCOLLECTIONS.userDismissedSuggestions, uid),
        { createdAt: serverTimestamp() },
      ).catch(() => {
        // It will simply be suggested again next time. Not worth
        // interrupting her for.
      });
    },
    [profile, remove],
  );

  return { closets, loading, follow, dismiss };
}
