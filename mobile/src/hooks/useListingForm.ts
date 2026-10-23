/**
 * The Add to Closet / Edit Listing form.
 *
 * Holds the draft, uploads photos, and writes the listing. Kept out of the
 * screen so the "add" and "edit" screens can share exactly the same rules
 * and can never drift apart.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  LIMITS,
  dollarsToCents,
  otherQuotaWrite,
  quotaWrite,
  validateListingDraft,
  type Category,
  type Condition,
  type ImageRef,
  type IsoDate,
  type ListingDraft,
  type ListingIntent,
  type MessageQuota,
  type Occasion,
  type ShoeSize,
  type Size,
  type User,
} from '@loane/shared';
import { db } from '../firebase/config';
import { saveErrorMessage } from '../firebase/errors';
import {
  cropToSquare,
  uploadFlatPhotoPng,
  uploadListingPhoto,
  type PickedPhoto,
} from '../lib/photo';
import { assertOnline } from '../network/connection';

/** Shown when she has hit the hourly ceiling on new pieces. */
export const LISTING_QUOTA_FULL_MESSAGE =
  "You've put a lot on Loane in the last hour. Take a breather and try this one again in a little while — your draft is still here.";

/** Her hourly new-piece counter, or null if she has none yet. */
async function readListingQuota(uid: string): Promise<MessageQuota | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.listingQuotas, uid)).catch(() => null);
  return snap?.exists() ? (snap.data() as MessageQuota) : null;
}

/**
 * Writes a NEW listing together with one tick of her hourly counter.
 * The security rules refuse a new listing that does not move the
 * counter by exactly one — see listingQuotas in firestore.rules.
 */
async function createCounted(
  ref: DocumentReference,
  uid: string,
  listing: Record<string, unknown>,
  quota: 'start' | 'bump',
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(ref, listing);
  const quotaDoc = doc(db, COLLECTIONS.listingQuotas, uid);
  if (quota === 'start') batch.set(quotaDoc, { windowStart: serverTimestamp(), count: 1 });
  else batch.update(quotaDoc, { count: increment(1) });
  await batch.commit();
}

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
        const ref = existingId
          ? doc(db, COLLECTIONS.listings, existingId)
          : doc(db, COLLECTIONS.listings);

        // A new piece needs room in her hourly counter. Checked before
        // any photo uploads, so a refused piece leaves no stray files.
        const windowMs = LIMITS.listingsPerHour.windowMs;
        const quota = existingId ? null : await readListingQuota(owner.uid);
        if (
          !existingId &&
          quota &&
          quota.count >= LIMITS.listingsPerHour.max &&
          quotaWrite(quota, Date.now(), windowMs) === 'bump'
        ) {
          setError(LISTING_QUOTA_FULL_MESSAGE);
          return null;
        }

        const photos: ImageRef[] = [];
        for (const [index, photo] of form.photos.entries()) {
          photos.push(
            photo.kind === 'uploaded'
              ? photo.ref
              : await uploadListingPhoto(owner.uid, ref.id, photo.picked, index),
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
              ? await uploadFlatPhotoPng(owner.uid, ref.id, form.flatPhoto.picked)
              : await uploadListingPhoto(owner.uid, ref.id, form.flatPhoto.picked, FLAT_PHOTO_INDEX)
          : null;

        const rentable = form.intent === 'rent' || form.intent === 'both';
        const sellable = form.intent === 'sell' || form.intent === 'both';

        const body = {
          id: ref.id,
          campusId: owner.campusId,
          ownerUid: owner.uid,
          owner: {
            uid: owner.uid,
            username: owner.username,
            displayName: owner.displayName,
            photoUrl: owner.photoUrl,
            campusId: owner.campusId,
            isVerified: owner.isVerified,
          },
          name: form.name.trim(),
          description: form.description.trim(),
          brand: form.brand.trim() || null,
          category: form.category!,
          size: form.size,
          shoeSize: form.shoeSize,
          condition: form.condition,
          occasions: form.occasions,
          colorNames: [],
          photos,
          coverUrl: photos[0]?.url ?? null,
          flatPhoto: flatPhoto,
          // Her premium stays null: most lenders never change it, and
          // a number she did not choose should not be stored as if she
          // did. See Listing.sameDay.
          sameDay: { enabled: form.sameDay, premiumBps: null },
          intent: form.intent!,
          // "Available now" off means it is listed but not bookable yet.
          status: form.availableNow ? ('active' as const) : ('paused' as const),
          pricing: {
            oneDayCents: rentable ? draft.oneDayCents : null,
            threeDayCents: rentable ? draft.threeDayCents : null,
            sevenDayCents: rentable ? draft.sevenDayCents : null,
          },
          cleaningFeeCents: rentable ? draft.cleaningFeeCents : null,
          salePriceCents: sellable ? draft.salePriceCents : null,
          garmentValueCents: draft.garmentValueCents ?? 0,
          // MVP: every rental request needs the lender's approval.
          requiresApproval: true,
          blackoutDates: form.blackoutDates,
          // Derived by a Cloud Function; never written from the app.
          suspendedReason: null,
          removedAt: null,
          updatedAt: serverTimestamp(),
        };

        if (existingId) {
          await updateDoc(ref, body);
        } else {
          const listing = {
            ...body,
            stats: { viewCount: 0, saveCount: 0, tagCount: 0, completedRentals: 0 },
            createdAt: serverTimestamp(),
          };
          const first = quotaWrite(quota, Date.now(), windowMs);
          try {
            await createCounted(ref, owner.uid, listing, first);
          } catch {
            // Her clock and the server's can disagree about whether the
            // hour is up. One retry with the other choice settles it;
            // a second refusal is real and falls through to the catch.
            try {
              await createCounted(ref, owner.uid, listing, otherQuotaWrite(first));
            } catch (err) {
              // Another phone of hers may have filled the hour meanwhile.
              const now = await readListingQuota(owner.uid);
              if ((now?.count ?? 0) >= LIMITS.listingsPerHour.max) {
                setError(LISTING_QUOTA_FULL_MESSAGE);
                return null;
              }
              throw err;
            }
          }
        }

        return ref.id;
      } catch (err) {
        // "Check your connection" was wrong and actively misleading:
        // the real failure here was the server refusing the write, and
        // blaming her wifi sent her retrying something that could never
        // work. Tell the truth about which of the two it was.
        setError(saveErrorMessage(err));
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
