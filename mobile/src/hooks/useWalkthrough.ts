/**
 * Whether to show the walkthrough, and remembering that she has seen it.
 *
 * Finishing and skipping write the SAME thing. Skipping is an answer,
 * and a tour that comes back after you dismissed it is not a tour, it
 * is a nag.
 *
 * REPLAY CLEARS THE TIMESTAMP rather than setting a local flag. Help
 * and the Feed are different screens holding different instances of
 * this hook, so a flag in one would never reach the other — the tour
 * would simply not appear, and the bug would look like the button
 * doing nothing. Firestore is the only thing both screens share.
 *
 * The cost is that `completedAt` means "when she last finished it"
 * rather than "when she first saw it". That is the right meaning for
 * the only thing that reads it: whether to show it now.
 */

import { useCallback } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import type { Timestampish } from '@loane/shared';
import { useUserSettings } from './useUserSettings';

export function useWalkthrough() {
  const { settings, loading, save } = useUserSettings();

  const seen = Boolean(settings?.walkthrough?.completedAt);

  const done = useCallback(async () => {
    await save({
      walkthrough: { completedAt: serverTimestamp() as unknown as Timestampish },
    });
  }, [save]);

  const replay = useCallback(async () => {
    await save({ walkthrough: { completedAt: null } });
  }, [save]);

  return {
    /** Hidden while loading, so it cannot flash up for somebody who has seen it. */
    visible: !loading && Boolean(settings) && !seen,
    replay,
    done,
  };
}
