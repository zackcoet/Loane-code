/**
 * The Add to Closet / Edit Listing form.
 *
 * Holds the draft, uploads photos, and writes the listing. Kept out of the
 * screen so the "add" and "edit" screens can share exactly the same rules
 * and can never drift apart.
 */

import { useCallback, useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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
import { uploadListingPhoto, type PickedPhoto } from '../lib/photo';

/** Photos in the form are either freshly picked or already uploaded. */
export type FormPhoto =
  | { kind: 'local'; picked: PickedPhoto }
  | { kind: 'uploaded'; ref: ImageRef };

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
  threeDay: string;
  sevenDay: string;
  salePrice: string;
  garmentValue: string;
  photos: FormPhoto[];
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
  threeDay: '',
  sevenDay: '',
  salePrice: '',
  garmentValue: '',
  photos: [],
  availableNow: true,
  blackoutDates: [],
};

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

export function useListingForm(initial: ListingFormState = EMPTY_FORM) {
  const [form, setForm] = useState<ListingFormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = useCallback(<K extends keyof ListingFormState>(key: K, value: ListingFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }, []);

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
      threeDayCents: toCents(form.threeDay),
      sevenDayCents: toCents(form.sevenDay),
      salePriceCents: toCents(form.salePrice),
      garmentValueCents: toCents(form.garmentValue),
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
        const ref = existingId
          ? doc(db, COLLECTIONS.listings, existingId)
          : doc(db, COLLECTIONS.listings);

        const photos: ImageRef[] = [];
        for (const [index, photo] of form.photos.entries()) {
          photos.push(
            photo.kind === 'uploaded'
              ? photo.ref
              : await uploadListingPhoto(owner.uid, ref.id, photo.picked, index),
          );
        }

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
          intent: form.intent!,
          // "Available now" off means it is listed but not bookable yet.
          status: form.availableNow ? ('active' as const) : ('paused' as const),
          pricing: {
            threeDayCents: rentable ? draft.threeDayCents : null,
            sevenDayCents: rentable ? draft.sevenDayCents : null,
          },
          salePriceCents: sellable ? draft.salePriceCents : null,
          garmentValueCents: draft.garmentValueCents ?? 0,
          // MVP: every rental request needs the lender's approval.
          requiresApproval: true,
          blackoutDates: form.blackoutDates,
          suspendedReason: null,
          removedAt: null,
          updatedAt: serverTimestamp(),
        };

        if (existingId) {
          await updateDoc(ref, body);
        } else {
          await setDoc(ref, {
            ...body,
            stats: { viewCount: 0, saveCount: 0, tagCount: 0, completedRentals: 0 },
            createdAt: serverTimestamp(),
          });
        }

        return ref.id;
      } catch {
        setError('Could not save that. Check your connection and try again.');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [draft, form],
  );

  return {
    form,
    set,
    toggleOccasion,
    addPhoto,
    removePhoto,
    makeCover,
    draft,
    error,
    setError,
    saving,
    save,
  };
}
