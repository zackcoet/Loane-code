/**
 * "Complete your profile" — what is left to do, and how far along she is.
 *
 * NOTHING HERE IS STORED. Every item is derived from data the profile
 * screen already loads: her photo, bio, sizes, following count and her
 * private settings. A stored `completedSteps` array would be a second
 * copy of the truth, and the two would drift the first time somebody
 * cleared their bio.
 *
 * Two things are stored, because there is no way to derive them: that
 * she dismissed the card, and that she once opened Find Friends. Both
 * live on her private settings document, which the app may write —
 * they move no counter and change only what she herself is shown.
 *
 * EVERY ITEM IS OPTIONAL. The card is a suggestion, not a gate; Part 5
 * is where photo and phone actually become required, and only for the
 * two or three actions that genuinely need them.
 */

import { useCallback, useMemo } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import type { Timestampish } from '@loane/shared';
import { useAuth } from '../auth/AuthProvider';
import { useUserSettings } from './useUserSettings';

/** How many closets she should follow before the item ticks. */
export const FOLLOW_GOAL = 3;

export interface ChecklistItem {
  key: 'photo' | 'bio' | 'phone' | 'sizes' | 'friends' | 'follow';
  label: string;
  /**
   * One honest line about why it helps. No statistics — we do not have
   * any, and inventing them to nudge somebody is not something we do.
   */
  hint: string;
  done: boolean;
  /** Where tapping the row goes. `null` means it is handled in place. */
  href: string | null;
}

export function useProfileChecklist() {
  const { profile } = useAuth();
  const { settings, loading, save } = useUserSettings();

  const items = useMemo<ChecklistItem[]>(() => {
    const sizes = profile?.sizes;
    return [
      {
        key: 'photo',
        label: 'Add a profile photo',
        hint: 'People lend to a face, not a blank circle.',
        done: Boolean(profile?.photoUrl),
        // Handled in place: tapping it opens the picker, because a
        // detour through a form for one photo is the thing we removed.
        href: null,
      },
      {
        key: 'bio',
        label: 'Write a short bio',
        hint: 'A line about your style tells renters what to expect.',
        done: Boolean(profile?.bio?.trim()),
        href: '/edit-profile',
      },
      {
        key: 'sizes',
        label: 'Add your sizes',
        hint: 'This is what "will it fit me?" is answered from when you rent.',
        done: Boolean(sizes?.tops || sizes?.bottoms || sizes?.dresses || sizes?.shoe),
        href: '/edit-profile',
      },
      {
        key: 'phone',
        label: 'Add your phone number',
        hint: 'Private. Handoffs happen in person, so the other student needs it.',
        done: Boolean(settings?.phone),
        href: '/edit-profile',
      },
      {
        key: 'friends',
        label: 'Find your friends',
        hint: 'See who from your campus is already on Loane.',
        done: Boolean(settings?.profileChecklist?.foundFriendsAt),
        href: '/find-friends',
      },
      {
        key: 'follow',
        label: `Follow ${FOLLOW_GOAL} closets`,
        hint: 'Your feed fills up with what they post.',
        done: (profile?.stats.followingCount ?? 0) >= FOLLOW_GOAL,
        href: '/(tabs)/discover',
      },
    ];
  }, [profile, settings]);

  const completed = items.filter((i) => i.done).length;
  const allDone = completed === items.length;
  const dismissed = Boolean(settings?.profileChecklist?.dismissed);

  const dismiss = useCallback(async () => {
    await save({
      profileChecklist: {
        dismissed: true,
        foundFriendsAt: settings?.profileChecklist?.foundFriendsAt ?? null,
      },
    });
  }, [save, settings]);

  /**
   * Called when she opens Find Friends. Written once and never again —
   * rewriting the timestamp on every visit would be a pointless write
   * and would make "when did she first look" unanswerable.
   */
  const markFoundFriends = useCallback(async () => {
    if (settings?.profileChecklist?.foundFriendsAt) return;
    await save({
      profileChecklist: {
        dismissed: Boolean(settings?.profileChecklist?.dismissed),
        // A server timestamp, not a client Date: a phone's clock can be
        // anything. Cast because the stored type is what comes BACK
        // from Firestore, and what goes in is the sentinel it resolves.
        foundFriendsAt: serverTimestamp() as unknown as Timestampish,
      },
    });
  }, [save, settings]);

  return {
    items,
    completed,
    total: items.length,
    allDone,
    /**
     * Hidden while the settings document is still loading, so the card
     * cannot flash up for half a second on a profile that is already
     * finished — which is exactly the person least interested in it.
     */
    visible: Boolean(profile) && !loading && !dismissed && !allDone,
    dismiss,
    markFoundFriends,
  };
}
