/**
 * "Follow 3 closets" — the last "Get started" step.
 *
 * A girl who follows nobody opens a Following tab with nothing in it
 * and a feed that knows nothing about her. Three follows is the
 * smallest number that makes both feel alive, so it is the target —
 * but only a target: Skip is always there, and a campus with fewer than
 * three closets to suggest lets her carry on with what there is.
 *
 * The list comes from `suggestedClosets`, which falls back to the
 * most-followed closets at her school when she has no follows yet (she
 * never does, here). Following goes through the `follow` function like
 * everywhere else — counters are the server's job.
 *
 * Unlike the feed's suggestion row, a followed card STAYS, with its
 * button turned to "Following" so a mistaken tap can be undone. Here the
 * point is to see the three add up.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { color, spacing } from '@loane/shared';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { LoadError } from './LoadError';
import { SkeletonRows } from './Skeleton';
import { Text } from './Text';
import { followUser, suggestedClosets, unfollowUser } from '../firebase/callables';
import { hapticFollow } from '../haptics';
import { logEvent } from '../analytics/events';
import type { SuggestedCloset } from '../hooks/useSuggestedClosets';

/** How many follows "Get started" asks for. */
export const FOLLOW_TARGET = 3;
const SUGGESTION_COUNT = 12;

interface Props {
  /**
   * Who she has followed on this step. Held by the screen, not here, so
   * going Back a step and returning does not forget them.
   */
  followed: ReadonlySet<string>;
  setFollowed: (update: (current: Set<string>) => Set<string>) => void;
  /** How many closets there are to follow, so the screen knows when "3" is impossible. */
  onAvailable: (count: number) => void;
}

export function FollowClosetsStep({ followed, setFollowed, onAvailable }: Props) {
  const [closets, setClosets] = useState<SuggestedCloset[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setFailed(false);
    setClosets(null);
    suggestedClosets({ limit: SUGGESTION_COUNT })
      .then((r) => {
        if (live) setClosets(r.data.closets);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => {
    // Until the list arrives, assume there are enough: Next stays off
    // while loading, and Skip is always there.
    if (closets) onAvailable(closets.length);
  }, [closets, onAvailable]);

  const toggle = useCallback(
    async (uid: string) => {
      const wasFollowing = followed.has(uid);
      const flip = (on: boolean) =>
        setFollowed((s) => {
          const next = new Set(s);
          if (on) next.add(uid);
          else next.delete(uid);
          return next;
        });
      // Instant, then undone if the server says no.
      flip(!wasFollowing);
      if (!wasFollowing) hapticFollow();
      try {
        if (wasFollowing) {
          await unfollowUser({ uid });
          logEvent('unfollow', { surface: 'onboarding', targetType: 'user', targetId: uid });
        } else {
          await followUser({ uid });
          logEvent('follow', {
            surface: 'onboarding',
            targetType: 'user',
            targetId: uid,
            meta: { from: 'get_started' },
          });
        }
      } catch {
        flip(wasFollowing);
      }
    },
    [followed, setFollowed],
  );

  if (failed) {
    return <LoadError what="closets" onRetry={() => setAttempt((n) => n + 1)} />;
  }
  if (!closets) return <SkeletonRows count={5} avatar={48} />;

  if (closets.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="body">No closets to suggest yet.</Text>
        <Text variant="bodySmall" tone="muted" style={styles.emptyNote}>
          You're one of the first here. Find people later from Discover, or invite your friends.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {closets.map((c) => {
        const on = followed.has(c.uid);
        return (
          <View key={c.uid} style={styles.row}>
            <Avatar url={c.photoUrl} name={c.displayName} size={48} />
            <View style={styles.who}>
              <Text variant="body" numberOfLines={1}>
                {c.displayName}
              </Text>
              <Text variant="bodySmall" tone="muted" numberOfLines={1}>
                {c.mutualCount > 0
                  ? `@${c.username} · ${c.mutualCount} mutual${c.mutualCount === 1 ? '' : 's'}`
                  : `@${c.username}`}
              </Text>
            </View>
            <Button
              label={on ? 'Following' : 'Follow'}
              // Merlot for the shared action, outline once done — as on a profile.
              variant={on ? 'outline' : 'dark'}
              onPress={() => void toggle(c.uid)}
              style={styles.button}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  who: { flex: 1 },
  button: { minWidth: 112 },
  empty: { paddingVertical: spacing.xl },
  emptyNote: { marginTop: spacing.sm },
});
