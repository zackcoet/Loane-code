/**
 * Records which looks she scrolled past and how long each stayed on
 * screen — the "saw it, skipped it" half of what the feed algorithm
 * learns from. The rules (what counts, once per session, the cap) live
 * in @loane/shared's impressions.ts; this only wires them to a list.
 *
 * Spread the return value onto a FlatList:
 *   const impressions = usePostImpressions('feed', { tab });
 *   <FlatList {...impressions} … />
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState, type ViewToken } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  IMPRESSION,
  ImpressionTracker,
  type EventSurface,
  type FinishedImpression,
} from '@loane/shared';
import { logEvent } from '../analytics/events';

/**
 * One tracker for the whole app session, shared by every list, so a look
 * seen in the feed and then again on a profile is still one impression.
 */
const tracker = new ImpressionTracker();

export function usePostImpressions(surface: EventSurface, context: Record<string, string> = {}) {
  // Read inside callbacks FlatList captured once, so keep it current.
  const contextRef = useRef(context);
  contextRef.current = context;

  const report = useCallback(
    (done: FinishedImpression[]) => {
      for (const d of done) {
        logEvent('post_impression', {
          surface,
          targetType: 'post',
          targetId: d.postId,
          meta: { dwellMs: d.dwellMs, position: d.position, ...contextRef.current },
        });
      }
    },
    [surface],
  );

  // FlatList refuses a new onViewableItemsChanged after mounting, so this
  // must be the same function for the life of the list.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const onScreen = viewableItems
      .filter((v) => v.isViewable && typeof v.key === 'string')
      .map((v) => ({ postId: v.key, position: v.index ?? 0 }));
    report(tracker.update(onScreen, Date.now()));
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: IMPRESSION.viewablePercent,
  }).current;

  // Leaving the screen ends what was on it…
  useFocusEffect(useCallback(() => () => report(tracker.flush(Date.now())), [report]));

  // …and so does switching Following / All Campus.
  const tabKey = JSON.stringify(context);
  useEffect(() => () => report(tracker.flush(Date.now())), [tabKey, report]);

  // …and so does putting the phone down.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') report(tracker.flush(Date.now()));
    });
    return () => sub.remove();
  }, [report]);

  return { onViewableItemsChanged, viewabilityConfig };
}
