/**
 * Only ask when it matters.
 *
 * Most of Loane asks for nothing. Browsing, liking, following,
 * commenting, saving — all of it works with an empty profile, because
 * a wall in front of looking around is how you lose somebody who has
 * not decided yet.
 *
 * Three things genuinely need something first, and each one has a
 * reason you can say out loud:
 *
 *   Post a look      photo          her face is on the post; a blank
 *                                   circle in the feed reads as a bot
 *   Put it on Loane  photo + phone  somebody is going to meet her in
 *                                   person to collect a garment
 *   Loane It / Own It  photo + phone  same, from the other side
 *
 * THE RULE IS ONE PLACE. If a fourth action needs something later it
 * goes in REQUIREMENTS, not into a new `if (!profile.photoUrl)` buried
 * in a screen — which is how three screens end up disagreeing about
 * what is required.
 *
 * NOTHING HERE NAVIGATES. The sheet opens over whatever she was
 * looking at and closes again, and then her original tap happens. She
 * is never sent to Edit Profile and left there wondering what she was
 * doing — which is the actual complaint this solves.
 */

import { useCallback, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useUserSettings } from './useUserSettings';

export type GatedAction = 'postLook' | 'listPiece' | 'rent' | 'buy';
export type Requirement = 'photo' | 'phone';

interface Spec {
  needs: Requirement[];
  /** Shown at the top of the sheet. What she was trying to do. */
  title: string;
  /** Why we are asking. Never "complete your profile" — that is not a reason. */
  reason: string;
}

const REQUIREMENTS: Record<GatedAction, Spec> = {
  postLook: {
    needs: ['photo'],
    title: 'Add a photo first',
    reason: 'Your look shows up in the campus feed with your face on it.',
  },
  listPiece: {
    needs: ['photo', 'phone'],
    title: 'Two things before you list',
    reason: 'Whoever rents this is going to meet you in person to collect it.',
  },
  rent: {
    needs: ['photo', 'phone'],
    title: 'Two things before you rent',
    reason: "You'll be meeting the lender in person to pick this up.",
  },
  buy: {
    needs: ['photo', 'phone'],
    title: 'Two things before you buy',
    reason: "You'll be meeting the seller in person to pick this up.",
  },
};

export function useProfileGate() {
  const { profile } = useAuth();
  const { settings } = useUserSettings();

  const [action, setAction] = useState<GatedAction | null>(null);
  /**
   * What to do once she is through the sheet.
   *
   * Held in a ref-like state setter wrapper because React treats a
   * bare function passed to setState as an updater and would call it.
   */
  const [pending, setPending] = useState<{ go: () => void } | null>(null);

  const missing = useCallback(
    (which: GatedAction): Requirement[] =>
      REQUIREMENTS[which].needs.filter((need) =>
        need === 'photo' ? !profile?.photoUrl : !settings?.phone,
      ),
    [profile, settings],
  );

  /**
   * Do `proceed`, asking for what is missing first if anything is.
   *
   * When nothing is missing this is a plain function call with no
   * sheet, no flicker and no delay — which is the common case and has
   * to stay free.
   */
  const run = useCallback(
    (which: GatedAction, proceed: () => void) => {
      if (missing(which).length === 0) {
        proceed();
        return;
      }
      setPending({ go: proceed });
      setAction(which);
    },
    [missing],
  );

  const close = useCallback(() => {
    setAction(null);
    setPending(null);
  }, []);

  /** Everything is filled in: shut the sheet and do what she asked for. */
  const complete = useCallback(() => {
    const go = pending?.go;
    setAction(null);
    setPending(null);
    go?.();
  }, [pending]);

  return {
    run,
    sheet: {
      action,
      spec: action ? REQUIREMENTS[action] : null,
      missing: action ? missing(action) : [],
      onClose: close,
      onComplete: complete,
    },
  };
}

export type ProfileGate = ReturnType<typeof useProfileGate>;
