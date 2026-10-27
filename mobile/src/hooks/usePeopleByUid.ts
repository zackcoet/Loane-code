/**
 * Turns a list of account ids into the people behind them, for the
 * Blocked and Muted settings lists.
 *
 * Deleted accounts are left out. Blocks and mutes other girls placed on
 * someone stay when she deletes her account (they were their choice),
 * but showing "@deleted-… Deleted account" with an Unblock button is
 * noise: the account can never come back, and its profile won't open.
 *
 * A failed fetch says so (`failed`) instead of returning nobody, so the
 * screen never shows "Nobody blocked" on a bad signal.
 */

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { COLLECTIONS, isDeletedAccount, type User } from '@loane/shared';
import { db } from '../firebase/config';

export function usePeopleByUid(
  uids: string[],
  /** False while the id list itself is still loading. */
  ready: boolean,
): { people: User[]; loading: boolean; failed: boolean; retry: () => void } {
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    if (uids.length === 0) {
      setPeople([]);
      setFailed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    Promise.all(uids.map((uid) => getDoc(doc(db, COLLECTIONS.users, uid))))
      .then((snaps) => {
        if (cancelled) return;
        setPeople(
          snaps
            .filter((s) => s.exists())
            .map((s) => s.data() as User)
            .filter((u) => !isDeletedAccount(u)),
        );
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uids, ready, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { people, loading: loading || !ready, failed, retry };
}
