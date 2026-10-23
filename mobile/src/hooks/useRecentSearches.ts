/**
 * Her recent Discover searches, kept on this phone only.
 *
 * Like Instagram's: a convenience, not data we need, so it never leaves
 * the device. Keyed by her uid so a borrowed or shared phone does not
 * show one girl's searches to the next. A storage failure just means an
 * empty list — never an error screen.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addRecentSearch, removeRecentSearch } from '@loane/shared';
import { useAuth } from '../auth/AuthProvider';

const keyFor = (uid: string) => `loane.recentSearches.v1.${uid}`;

export function useRecentSearches() {
  const { profile } = useAuth();
  const uid = profile?.uid ?? null;
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!uid) {
      setRecent([]);
      return;
    }
    let live = true;
    AsyncStorage.getItem(keyFor(uid))
      .then((raw) => {
        if (!live || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecent(parsed.filter((t): t is string => typeof t === 'string'));
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [uid]);

  const persist = useCallback(
    (next: string[]) => {
      setRecent(next);
      if (uid) void AsyncStorage.setItem(keyFor(uid), JSON.stringify(next)).catch(() => {});
    },
    [uid],
  );

  const remember = useCallback(
    (term: string) => persist(addRecentSearch(recent, term)),
    [persist, recent],
  );
  const forget = useCallback(
    (term: string) => persist(removeRecentSearch(recent, term)),
    [persist, recent],
  );
  const clear = useCallback(() => persist([]), [persist]);

  return { recent, remember, forget, clear };
}
