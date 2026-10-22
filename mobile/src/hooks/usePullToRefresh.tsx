/**
 * Pull to refresh for a list.
 *
 * Almost every list in Loane is a live Firestore listener: a new booking,
 * message or review appears on its own, with no pull needed. Re-opening a
 * healthy listener would re-read every row (a cost) and flash the
 * full-screen loader (a worse look), for data that is already current.
 *
 * So on a live list the pull is the gesture girls expect from Instagram
 * and nothing more: the spinner shows briefly and the list is, truthfully,
 * up to date. Screens that hold something still on purpose — Discover's
 * "For you" order, which never reshuffles while she browses — pass a
 * `work` that works it out again, like the feed already does.
 *
 * A failed listener is not reached this way: those screens show
 * "Couldn't load … Try again" instead of the list.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';
import { color } from '@loane/shared';

/** Long enough to read as "checked", short enough not to feel slow. */
const SPIN_MS = 600;

export function usePullToRefresh(work?: () => void) {
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    work?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRefreshing(false), SPIN_MS);
  }, [work]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={color.icon.default}
      colors={[color.icon.default]}
    />
  );

  return { refreshing, onRefresh, refreshControl };
}
