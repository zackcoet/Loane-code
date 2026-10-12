/**
 * Try-on, from the app's side.
 *
 * Deliberately thin. Everything that costs money, decides eligibility
 * or records consent happens in a Cloud Function — these hooks fetch,
 * display and get out of the way.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import {
  COLLECTIONS,
  TRYON_CATEGORY_MAP,
  type Listing,
  type PresetId,
  type TryOn,
} from '@loane/shared';
import { db, storage } from '../firebase/config';
import {
  clearTryOnBodyPhoto,
  generateTryOn,
  type TryOnPieceSummary,
} from '../firebase/callables';
import { callableErrorMessage } from '../firebase/errors';
import { useAuth } from '../auth/AuthProvider';
import { useWishlist } from './useSaved';
import { useSavedPosts } from './usePostEngagement';
import { useListingsByIds } from './useListingsByIds';
import { useUserSettings } from './useUserSettings';
import { logEvent } from '../analytics/events';

/** Whether this listing can be tried on at all. The server checks again. */
export function isTryOnEligible(listing: Pick<Listing, 'category' | 'flatPhoto'>): boolean {
  return Boolean(listing.flatPhoto) && listing.category in TRYON_CATEGORY_MAP;
}

/**
 * Her body photo: whether she has one, and removing it.
 *
 * Removing goes through a function because the whole `tryOn` block is
 * outside the app-writable allowlist — and because a "remove" that only
 * cleared a pointer would leave the photograph on our disks.
 */
export function useTryOnBody() {
  const { settings } = useUserSettings();
  const [clearing, setClearing] = useState(false);

  const clear = useCallback(async () => {
    setClearing(true);
    try {
      await clearTryOnBodyPhoto();
      logEvent('tryon_body_photo_delete', { surface: 'tryon' });
    } finally {
      setClearing(false);
    }
  }, []);

  return {
    hasPhoto: Boolean(settings?.tryOn?.bodyPhotoPath),
    clearing,
    clear,
  };
}

/**
 * Turns a Storage PATH into something an <Image> can render.
 *
 * Results are owner-read, so this only ever works for her own files —
 * which is the point. The URL is fetched with her credentials and is
 * not stored anywhere.
 */
export function useTryOnImage(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    getDownloadURL(ref(storage, path))
      .then((value) => {
        if (!cancelled) setUrl(value);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

/**
 * The dressing room.
 *
 * SLOTS, NOT A STACK. A garment occupies a slot — a top or a dress —
 * and tapping a different top swaps the top rather than layering onto
 * it. A dress clears the top, and a top clears the dress, because a
 * dress is a one-piece and wearing both is not a thing. This is what
 * "tap to put on, tap again to take off" actually requires: a stack
 * can only be unwound from the end, and she expects to take off the
 * thing she tapped.
 *
 * EVERY LOOK SHE HAS SEEN THIS SESSION IS KEPT, by outfit. Taking a
 * garment off goes back to the image we already have, instantly, with
 * no network call and no cost — the server would also serve it from
 * its cache, but a round trip to be told what we already know is still
 * a second of staring at a spinner.
 *
 * The bare body is just her photo, so undressing completely costs
 * nothing either.
 *
 * Bottoms have a slot here and no way to fill it: they are not
 * launched. When they are, layering a top over bottoms works without
 * touching this logic.
 */
export type Slot = 'top' | 'bottom' | 'dress';

export function slotFor(category: string): Slot {
  if (category === 'dresses') return 'dress';
  if (category === 'bottoms') return 'bottom';
  // Outerwear maps to FASHN's 'tops' and shares the Tops tab.
  return 'top';
}

export type Worn = Partial<Record<Slot, TryOnPieceSummary>>;

/** The outfit, in the order the server should apply it. */
function outfitOf(worn: Worn): TryOnPieceSummary[] {
  if (worn.dress) return [worn.dress];
  // Bottoms first, then the top over them: Phase 0 showed whatever
  // goes on second survives best, and the top is what she is looking at.
  return [worn.bottom, worn.top].filter(Boolean) as TryOnPieceSummary[];
}

/** Identity of a look. '' is the bare body. */
function outfitKey(outfit: TryOnPieceSummary[]): string {
  return outfit.map((p) => p.listingId).join('|');
}

export interface DressingRoomState {
  busy: boolean;
  error: string | null;
  remaining: number | null;
}

export function useDressingRoom(
  bodyKind: 'own' | 'preset',
  presetId: PresetId | undefined,
  /** Shown when nothing is on, and the fallback while a look loads. */
  bodyUrl: string | null,
) {
  const [worn, setWorn] = useState<Worn>({});
  const [state, setState] = useState<DressingRoomState>({
    busy: false,
    error: null,
    remaining: null,
  });

  /**
   * Every look generated this session, by outfit key. This is what
   * makes taking something off free — and what lets the row say
   * "uses 1 try-on" only where it is true.
   */
  const [looks, setLooks] = useState<Record<string, { tryOnId: string; imagePath: string }>>({});

  const outfit = useMemo(() => outfitOf(worn), [worn]);
  const key = outfitKey(outfit);
  const known = looks[key];

  // What is on screen right now. The bare body is her own photo.
  const shownPath = key === '' ? null : (known?.imagePath ?? null);
  const shownUrl = useTryOnImage(shownPath) ?? (key === '' ? bodyUrl : null);

  useEffect(() => {
    // Nothing on, or we already have this exact look: no call at all.
    if (key === '' || looks[key]) {
      setState((s) => ({ ...s, busy: false, error: null }));
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, busy: true, error: null }));

    generateTryOn({ bodyKind, presetId, listingIds: outfit.map((p) => p.listingId) })
      .then((result) => {
        if (cancelled) return;
        logEvent('tryon_generate', {
          surface: 'tryon',
          targetType: 'listing',
          targetId: outfit[outfit.length - 1]!.listingId,
          // The hit rate is what decides whether paid credits can work.
          meta: { cached: result.data.cached, pieces: outfit.length },
        });
        setLooks((current) => ({
          ...current,
          [key]: { tryOnId: result.data.tryOnId, imagePath: result.data.imagePath },
        }));
        setState({ busy: false, error: null, remaining: result.data.remaining });
      })
      .catch((err) => {
        if (cancelled) return;
        // The allowance message comes from the server, so there is one
        // place that knows what the limit is.
        setState((s) => ({
          ...s,
          busy: false,
          error: callableErrorMessage(err, 'Could not try that on. Try again.'),
        }));
        // Take it back off, so she is not left looking at the previous
        // outfit while the row says she is wearing something else.
        setWorn((w) => {
          const next = { ...w };
          for (const slot of Object.keys(next) as Slot[]) {
            if (next[slot] && outfit.some((p) => p.listingId === next[slot]!.listingId)) {
              delete next[slot];
            }
          }
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
    // `key` is the whole identity of the request.
  }, [key]);

  /** Tap: on if it is off, off if it is on, swapping within its slot. */
  const tap = useCallback((piece: TryOnPieceSummary) => {
    const slot = slotFor(piece.category);
    setWorn((current) => {
      if (current[slot]?.listingId === piece.listingId) {
        const next = { ...current };
        delete next[slot];
        return next;
      }
      if (slot === 'dress') return { dress: piece };
      // A top or bottoms replace the dress, because a dress is both.
      const { dress: _dress, ...rest } = current;
      return { ...rest, [slot]: piece };
    });
  }, []);

  const reset = useCallback(() => setWorn({}), []);

  /** Would tapping this spend a try-on? Only if we have not seen it. */
  const costsAGeneration = useCallback(
    (piece: TryOnPieceSummary) => {
      const slot = slotFor(piece.category);
      if (worn[slot]?.listingId === piece.listingId) return false; // taking off
      const next: Worn =
        slot === 'dress'
          ? { dress: piece }
          : { ...Object.fromEntries(Object.entries(worn).filter(([k]) => k !== 'dress')), [slot]: piece };
      return !looks[outfitKey(outfitOf(next))];
    },
    [worn, looks],
  );

  return {
    worn,
    outfit,
    isWearing: (listingId: string) => outfit.some((p) => p.listingId === listingId),
    tap,
    reset,
    costsAGeneration,
    state,
    shownUrl,
    /** The saved-look id for what is on screen, or null for the bare body. */
    currentTryOnId: known?.tryOnId ?? null,
  };
}

/**
 * Her fitting room: everything she has saved, whether or not it can be
 * tried on.
 *
 * TWO SOURCES, because "saved" means two things to her and one thing
 * to the database. Pieces she tapped the heart on, and pieces tagged
 * in looks she saved — a dress she starred on somebody's gameday post
 * is a dress she is interested in, and making her go and find the
 * listing to save it again would be busywork.
 *
 * INELIGIBLE PIECES ARE RETURNED, NOT FILTERED OUT. This is the one
 * place that differs from the rest of try-on, and deliberately: in a
 * browse, a piece without a flat photo is simply not offered, because
 * a disclaimer cannot fix a confidently wrong image. Here she is
 * looking at HER OWN saved things, and a row that quietly drops half
 * of them reads as broken rather than filtered. So they show, greyed,
 * saying why. Zack's call, 2026-10-12.
 *
 * The server gate is unchanged either way — an ineligible piece cannot
 * be generated, it can only be explained.
 */
export function useFittingRoom() {
  const wishlist = useWishlist();
  const savedPosts = useSavedPosts();

  // Pieces tagged in looks she saved. taggedListingIds is maintained by
  // a Cloud Function, so this needs no reading of per-photo tags.
  const taggedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const post of savedPosts.posts) {
      for (const id of post.taggedListingIds ?? []) ids.add(id);
    }
    return [...ids];
  }, [savedPosts.posts]);

  const tagged = useListingsByIds(taggedIds, taggedIds.length > 0);

  const pieces = useMemo(() => {
    const seen = new Set<string>();
    const all: Listing[] = [];
    // Directly saved first: a piece she deliberately hearted is a
    // better suggestion than one she saw in somebody's post.
    for (const listing of [...wishlist.listings, ...tagged.listings]) {
      if (seen.has(listing.id)) continue;
      seen.add(listing.id);
      if (listing.status !== 'active') continue;
      all.push(listing);
    }
    return all;
  }, [wishlist.listings, tagged.listings]);

  return {
    pieces,
    loading: wishlist.loading || savedPosts.loading,
  };
}

/** Her saved looks, newest first. */
export function useMyTryOns() {
  const { profile } = useAuth();
  const [items, setItems] = useState<TryOn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.tryOns),
        where('uid', '==', profile.uid),
        where('saved', '==', true),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
        setItems(snap.docs.map((d) => d.data() as TryOn));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [profile?.uid]);

  return { items, loading };
}

/**
 * Saving and deleting a look.
 *
 * `saved` is the one field the app may write on a tryOn document, and
 * deleting her own is allowed — everything else is a function's job.
 */
export function useSaveTryOn() {
  const save = useCallback(async (tryOnId: string) => {
    await updateDoc(doc(db, COLLECTIONS.tryOns, tryOnId), {
      saved: true,
      updatedAt: serverTimestamp(),
    });
    logEvent('tryon_save', { surface: 'tryon', targetType: null, targetId: tryOnId });
  }, []);

  const remove = useCallback(async (tryOnId: string) => {
    await deleteDoc(doc(db, COLLECTIONS.tryOns, tryOnId));
  }, []);

  return { save, remove };
}

/** The on/off switch, so the app can hide the feature without a deploy. */
export function useTryOnEnabled() {
  const { profile } = useAuth();
  const [config, setConfig] = useState<{ enabled: boolean; enabledForAdmins: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(
      doc(db, COLLECTIONS.config, 'tryOn'),
      (snap) => {
        const data = snap.data() as { enabled?: boolean; enabledForAdmins?: boolean } | undefined;
        setConfig({
          enabled: data?.enabled ?? false,
          enabledForAdmins: data?.enabledForAdmins ?? true,
        });
      },
      // A missing or unreadable config is not an open door.
      () => setConfig({ enabled: false, enabledForAdmins: false }),
    );
  }, [profile?.uid]);

  return useMemo(() => {
    if (!config) return false;
    if (config.enabled) return true;
    return config.enabledForAdmins && profile?.role === 'admin';
  }, [config, profile?.role]);
}
