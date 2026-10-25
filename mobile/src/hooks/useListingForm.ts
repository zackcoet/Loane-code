/**
 * The Add to Closet / Edit Listing form.
 *
 * Holds the draft, uploads photos, and writes the listing. Kept out of the
 * screen so the "add" and "edit" screens can share exactly the same rules
 * and can never drift apart.
 */

import { useCallback, useMemo, useState } from 'react';
import { collection, doc } from 'firebase/firestore';
import { FunctionsError } from 'firebase/functions';
import {
  COLLECTIONS,
  LIMITS,
  dollarsToCents,
  validateListingDraft,
  type Category,
  type Condition,
  type ImageRef,
  type IsoDate,
  type ListingDraft,
  type ListingIntent,
  type Occasion,
  type ShoeSize,
  type Size,
  type User,
} from '@loane/shared';
import { db } from '../firebase/config';
import { writeListing } from '../firebase/callables';
import { callableErrorMessage, saveErrorMessage } from '../firebase/errors';
import {
  cropToSquare,
  uploadFlatPhotoPng,
  uploadListingPhoto,
  type PickedPhoto,
} from '../lib/photo';
import { assertOnline } from '../network/connection';

/** Photos in the form are either freshly picked or already uploaded. */
export type FormPhoto =
  { kind: 'local'; picked: PickedPhoto } | { kind: 'uploaded'; ref: ImageRef };

export interface ListingFormState {
  name: string;
  description: string;
  brand: string;
  category: Category | null;
  size: Size | null;
  shoeSize: ShoeSize | null;
  condition: Condition;
  occasions: Occasion[];
  intent: ListingIntent | null;
  /** Kept as typed text so "12.5" behaves while she is still typing. */
  oneDay: string;
  threeDay: string;
  sevenDay: string;
  salePrice: string;
  garmentValue: string;
  /** Optional. Blank means she does not charge for cleaning. */
  cleaningFee: string;
  photos: FormPhoto[];
  /**
   * The lay-it-flat photo. Optional, and its presence is what switches
   * "Try it on" on for this piece — see docs/decisions.md for why the
   * gate exists rather than a disclaimer.
   */
  flatPhoto: FormPhoto | null;
  /** She will hand it over today if asked. */
  sameDay: boolean;
  availableNow: boolean;
  blackoutDates: IsoDate[];
}

export const EMPTY_FORM: ListingFormState = {
  name: '',
  description: '',
  brand: '',
  category: null,
  size: null,
  shoeSize: null,
  condition: 'like_new',
  occasions: [],
  intent: null,
  oneDay: '',
  threeDay: '',
  sevenDay: '',
  salePrice: '',
  garmentValue: '',
  cleaningFee: '',
  photos: [],
  flatPhoto: null,
  sameDay: false,
  availableNow: true,
  blackoutDates: [],
};

/**
 * The flat photo's slot in the upload path. Far above the gallery
 * maximum so the two can never overwrite one another.
 */
const FLAT_PHOTO_INDEX = 99;

/** "" -> null, "25" -> 2500. Anything unparseable becomes null. */
function toCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return dollarsToCents(parsed);
}

export function photoUri(photo: FormPhoto): string {
  return photo.kind === 'local' ? photo.picked.uri : photo.ref.url;
}

/**
 * Has she put anything of her own into a new piece's form? Occasions and
 * rent-or-sell are left out on purpose: Quick add fills those in for her
 * from the look, and leaving a form she never touched must not ask
 * "Discard this piece?".
 */
export function listingFormStarted(form: ListingFormState): boolean {
  const typed = [
    form.name,
    form.description,
    form.brand,
    form.oneDay,
    form.threeDay,
    form.sevenDay,
    form.salePrice,
    form.garmentValue,
    form.cleaningFee,
  ].some((text) => text.trim() !== '');
  return (
    typed ||
    form.photos.length > 0 ||
    form.flatPhoto !== null ||
    form.category !== null ||
    form.size !== null ||
    form.shoeSize !== null
  );
}

export function useListingForm(initial: ListingFormState = EMPTY_FORM) {
  const [form, setForm] = useState<ListingFormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Replaces the whole form in one go. Used by the edit screen when the
   * listing arrives — setting fields one at a time would re-render for
   * each and risk an update loop.
   */
  const hydrate = useCallback((next: ListingFormState) => {
    setForm(next);
    setError(null);
  }, []);

  const set = useCallback(
    <K extends keyof ListingFormState>(key: K, value: ListingFormState[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
      setError(null);
    },
    [],
  );

  const toggleOccasion = useCallback((occasion: Occasion) => {
    setForm((current) => ({
      ...current,
      occasions: current.occasions.includes(occasion)
        ? current.occasions.filter((o) => o !== occasion)
        : [...current.occasions, occasion],
    }));
    setError(null);
  }, []);

  const addPhoto = useCallback((picked: PickedPhoto) => {
    setForm((current) =>
      current.photos.length >= LIMITS.listingPhotos.max
        ? current
        : { ...current, photos: [...current.photos, { kind: 'local', picked }] },
    );
    setError(null);
  }, []);

  const removePhoto = useCallback((index: number) => {
    setForm((current) => ({
      ...current,
      photos: current.photos.filter((_, i) => i !== index),
    }));
  }, []);

  /** Move a photo to the front — the first photo is the cover. */
  /**
   * Crop one photo to a centred square, on request.
   *
   * Only a local pick can be cropped. An already-uploaded photo would
   * mean re-uploading and orphaning the old file in Storage, which is
   * more machinery than "I picked the wrong shape" deserves — remove
   * it and add it again.
   */
  const cropPhoto = useCallback(
    async (index: number) => {
      const target = form.photos[index];
      if (!target || target.kind !== 'local') return;
      const square = await cropToSquare(target.picked);
      setForm((current) => ({
        ...current,
        photos: current.photos.map((p, i) =>
          i === index ? { kind: 'local' as const, picked: square } : p,
        ),
      }));
    },
    [form.photos],
  );

  const makeCover = useCallback((index: number) => {
    setForm((current) => {
      const next = [...current.photos];
      const [chosen] = next.splice(index, 1);
      if (chosen) next.unshift(chosen);
      return { ...current, photos: next };
    });
  }, []);

  /** The shape the shared validator understands. */
  const draft = useMemo<ListingDraft>(
    () => ({
      name: form.name,
      description: form.description,
      brand: form.brand.trim() || null,
      category: form.category,
      size: form.size,
      shoeSize: form.shoeSize,
      condition: form.condition,
      occasions: form.occasions,
      intent: form.intent,
      oneDayCents: toCents(form.oneDay),
      threeDayCents: toCents(form.threeDay),
      sevenDayCents: toCents(form.sevenDay),
      salePriceCents: toCents(form.salePrice),
      garmentValueCents: toCents(form.garmentValue),
      cleaningFeeCents: toCents(form.cleaningFee),
      photoCount: form.photos.length,
    }),
    [form],
  );

  /**
   * Writes the listing.
   *
   * Photos upload first, because they need the listing id in their storage
   * path and because a half-uploaded set is better discovered before the
   * document exists than after.
   */
  const save = useCallback(
    async (owner: User, existingId?: string): Promise<string | null> => {
      const check = validateListingDraft(draft);
      if (!check.ok) {
        setError(check.error ?? 'Something is missing.');
        return null;
      }

      setSaving(true);
      setError(null);
      try {
        assertOnline();
        // A new piece's id is picked here, without saving anything: its
        // photos go in a folder named after it, and the server then
        // checks every photo really is in that folder.
        const listingId = existingId ?? doc(collection(db, COLLECTIONS.listings)).id;

        const photos: ImageRef[] = [];
        for (const [index, photo] of form.photos.entries()) {
          photos.push(
            photo.kind === 'uploaded'
              ? photo.ref
              : await uploadListingPhoto(owner.uid, listingId, photo.picked, index),
          );
        }

        /**
         * Uploaded under a reserved index so it can never collide with
         * a gallery photo, and so swapping it changes the stored path —
         * which is what the try-on cache key watches to know the photo
         * was replaced.
         */
        /*
          Uploaded WITHOUT recompressing when it is a cutout.

          prepareFlatPhoto returns a transparent PNG. Running that
          through the usual JPEG compressor flattens the transparency —
          to black, on most devices — which would turn a clean cutout
          into a garment on a black rectangle, and nobody would know
          why until they saw a try-on.
        */
        const flatPhoto: ImageRef | null = form.flatPhoto
          ? form.flatPhoto.kind === 'uploaded'
            ? form.flatPhoto.ref
            : form.flatPhoto.picked.uri.endsWith('.png')
              ? await uploadFlatPhotoPng(owner.uid, listingId, form.flatPhoto.picked)
              : await uploadListingPhoto(
                  owner.uid,
                  listingId,
                  form.flatPhoto.picked,
                  FLAT_PHOTO_INDEX,
                )
          : null;

        // Saved by the server, which copies her name and photo from her
        // profile, checks every photo is her own upload, and counts new
        // pieces against the hourly limit.
        await writeListing({
          listingId,
          isNew: !existingId,
          name: form.name,
          description: form.description,
          brand: draft.brand,
          category: form.category!,
          size: form.size,
          shoeSize: form.shoeSize,
          condition: form.condition,
          occasions: form.occasions,
          intent: form.intent!,
          oneDayCents: draft.oneDayCents,
          threeDayCents: draft.threeDayCents,
          sevenDayCents: draft.sevenDayCents,
          salePriceCents: draft.salePriceCents,
          garmentValueCents: draft.garmentValueCents,
          cleaningFeeCents: draft.cleaningFeeCents,
          photos,
          flatPhoto,
          sameDay: form.sameDay,
          availableNow: form.availableNow,
        });

        return listingId;
      } catch (err) {
        // "Check your connection" was wrong and actively misleading:
        // the real failure here was the server refusing the write, and
        // blaming her wifi sent her retrying something that could never
        // work. Tell the truth about which of the two it was.
        // The server's own words when it was the server that said no
        // (a missing price, the hourly limit); otherwise the photo upload
        // failed, and saveErrorMessage knows those.
        setError(
          err instanceof FunctionsError
            ? callableErrorMessage(
                err,
                'Could not save that. Try again, and tell us if it keeps happening.',
              )
            : saveErrorMessage(err),
        );
        return null;
      } finally {
        setSaving(false);
      }
    },
    [draft, form],
  );

  return {
    form,
    hydrate,
    set,
    toggleOccasion,
    addPhoto,
    removePhoto,
    cropPhoto,
    makeCover,
    draft,
    error,
    setError,
    saving,
    save,
  };
}
