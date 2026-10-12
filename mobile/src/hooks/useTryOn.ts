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

export interface GenerateState {
  busy: boolean;
  error: string | null;
  /** Null until she has generated something this session. */
  result: { tryOnId: string; imagePath: string } | null;
  remaining: number | null;
}

/**
 * Dressing the body.
 *
 * The stack is the list of pieces currently on her, in order. Undo pops
 * one and regenerates from scratch rather than trying to subtract a
 * garment from an image, which is not a thing that can be done.
 */
export function useTryOnStack(bodyKind: 'own' | 'preset', presetId?: PresetId) {
  const [stack, setStack] = useState<TryOnPieceSummary[]>([]);
  const [state, setState] = useState<GenerateState>({
    busy: false,
    error: null,
    result: null,
    remaining: null,
  });

  const run = useCallback(
    async (pieces: TryOnPieceSummary[]) => {
      if (pieces.length === 0) {
        setState((s) => ({ ...s, result: null, error: null }));
        return;
      }
      setState((s) => ({ ...s, busy: true, error: null }));
      try {
        const result = await generateTryOn({
          bodyKind,
          presetId,
          listingIds: pieces.map((p) => p.listingId),
        });
        logEvent('tryon_generate', {
          surface: 'tryon',
          targetType: 'listing',
          targetId: pieces[pieces.length - 1]!.listingId,
          // The hit rate is what decides whether paid credits can work.
          meta: { cached: result.data.cached, pieces: pieces.length },
        });
        setState({
          busy: false,
          error: null,
          result: { tryOnId: result.data.tryOnId, imagePath: result.data.imagePath },
          remaining: result.data.remaining,
        });
      } catch (err) {
        // The limit message arrives from the server, so there is one
        // place that knows what the allowance is.
        setState((s) => ({
          ...s,
          busy: false,
          error: callableErrorMessage(err, 'Could not try that on. Try again.'),
        }));
      }
    },
    [bodyKind, presetId],
  );

  const add = useCallback(
    (piece: TryOnPieceSummary) => {
      setStack((current) => {
        // Same piece tapped twice is a no-op, not a second layer.
        if (current.some((p) => p.listingId === piece.listingId)) return current;
        const next = [...current, piece];
        void run(next);
        return next;
      });
    },
    [run],
  );

  const undo = useCallback(() => {
    setStack((current) => {
      const next = current.slice(0, -1);
      void run(next);
      return next;
    });
  }, [run]);

  const reset = useCallback(() => {
    setStack([]);
    setState({ busy: false, error: null, result: null, remaining: null });
  }, []);

  return { stack, state, add, undo, reset };
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
