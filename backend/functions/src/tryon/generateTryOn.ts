/**
 * `generateTryOn`
 *
 * Everything that costs money runs here. The app cannot write one field
 * of a `tryOn` document and cannot call FASHN at all.
 *
 * The order of the checks is the design:
 *
 *   1. Is the feature on for her?
 *   2. Are the pieces actually eligible — flat photo, allowed category?
 *      The client hides the button, but the client is not to be trusted.
 *   3. Is it already cached? If so, return it and spend NOTHING, and do
 *      not touch her allowance.
 *   4. Only now, has she any allowance left?
 *   5. Generate, store, write the document, count it.
 *
 * STEP 3 BEFORE STEP 4 IS DELIBERATE. A cached result costs us nothing,
 * so charging an allowance for it would be charging her for our saving
 * — and it would make the shared preset cache feel like a penalty
 * rather than the thing that makes presets worth having.
 */

import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  SUBCOLLECTIONS,
  TRYON_CATEGORY_MAP,
  TRYON_FREE_LIFETIME,
  TRYON_LIMIT_MESSAGE,
  TRYON_PRESETS,
  type Listing,
  type PresetId,
  type TryOn,
  type TryOnPiece,
  type UserPrivate,
  type UserTryOn,
} from '@loane/shared';
import { db, now } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { assertTryOnEnabled } from './config';
import { tryOnCacheKey, isSharedKey, type CacheBody } from './cacheKey';
import { FASHN_API_KEY, runTryOn, type FashnCategory } from './fashn';
import { presetImageDataUri, bodyPhotoDataUri, garmentDataUri, storeResult } from './images';

/** Two layers is the Phase 1 ceiling; layering beyond that was not tested. */
const MAX_PIECES = 2;

interface Input {
  bodyKind?: 'own' | 'preset';
  presetId?: PresetId;
  listingIds?: string[];
}

export interface GenerateResult {
  tryOnId: string;
  imagePath: string;
  /** Recorded as an event, because the hit rate decides the economics. */
  cached: boolean;
  /** What she has left, so the UI never has to guess. */
  remaining: number;
}

/** Her allowance: the free lifetime grant plus anything an admin added. */
function allowanceOf(tryOn: UserTryOn | undefined): { used: number; total: number } {
  const used = tryOn?.generationsUsed ?? 0;
  const total = TRYON_FREE_LIFETIME + (tryOn?.bonusGranted ?? 0);
  return { used, total };
}

export const generateTryOn = onCall<Input, Promise<GenerateResult>>(
  { region: 'us-central1', secrets: [FASHN_API_KEY], timeoutSeconds: 120, memory: '512MiB' },
  async (request: CallableRequest<Input>) => {
    const me = await requireVerifiedStudent(request);
    await assertTryOnEnabled(request);

    const bodyKind = request.data?.bodyKind ?? 'preset';
    const listingIds = request.data?.listingIds ?? [];

    if (listingIds.length === 0) throw invalidArgument('Pick a piece to try on.');
    if (listingIds.length > MAX_PIECES) {
      throw invalidArgument(`You can layer up to ${MAX_PIECES} pieces.`);
    }

    // --- Her private settings: body photo and allowance ------------------
    const privateRef = db()
      .collection(COLLECTIONS.users)
      .doc(me.uid)
      .collection(SUBCOLLECTIONS.userPrivate)
      .doc('settings');
    const privateSnap = await privateRef.get();
    const settings = privateSnap.data() as UserPrivate | undefined;

    // --- The body ---------------------------------------------------------
    let body: CacheBody;
    if (bodyKind === 'preset') {
      const presetId = request.data?.presetId;
      if (!presetId || !(TRYON_PRESETS as readonly string[]).includes(presetId)) {
        throw invalidArgument('Pick a body to try it on.');
      }
      body = { kind: 'preset', presetId };
    } else {
      const path = settings?.tryOn?.bodyPhotoPath;
      const uploadedAt = settings?.tryOn?.bodyPhotoUploadedAt;
      if (!path || !uploadedAt) throw failed('Add a photo of yourself first.');
      // She must have confirmed it is her. Recorded at upload; checked
      // here so an old document written before that rule cannot slip by.
      if (!settings?.tryOn?.selfConfirmedAt) throw failed('Add a photo of yourself first.');
      body = { kind: 'own', bodyPhotoPath: path, uploadedAt: String(uploadedAt) };
    }

    // --- The pieces, validated server-side --------------------------------
    const listingSnaps = await db().getAll(
      ...listingIds.map((id) => db().collection(COLLECTIONS.listings).doc(id)),
    );

    const pieces: TryOnPiece[] = [];
    const fashnCategories: FashnCategory[] = [];
    const keyPieces = [];

    for (const snap of listingSnaps) {
      if (!snap.exists) throw notFound('That piece is no longer listed.');
      const listing = snap.data() as Listing;

      if (listing.status === 'removed' || listing.status === 'suspended') {
        throw failed('That piece is no longer available.');
      }

      // THE GATE. Not a warning and not a disclaimer — without a flat
      // photo this is simply not generatable, because Phase 0 showed a
      // busy photo fails silently by rendering the wrong garment well.
      if (!listing.flatPhoto) {
        throw failed('That piece does not have a lay-it-flat photo yet.');
      }

      const mapped = (TRYON_CATEGORY_MAP as Record<string, FashnCategory | undefined>)[
        listing.category
      ];
      if (!mapped) {
        // How underwear and swimwear are excluded: not by a filter, but
        // by never being eligible in the first place.
        throw failed('That kind of piece cannot be tried on yet.');
      }

      pieces.push({
        listingId: snap.id,
        name: listing.name,
        coverUrl: listing.coverUrl,
        ownerUid: listing.ownerUid,
        category: listing.category,
      });
      fashnCategories.push(mapped);
      keyPieces.push({
        listingId: snap.id,
        // Any stamp that CHANGES when the photo does. The path carries
        // the upload's identity, so replacing the photo misses the cache.
        flatPhotoStamp: listing.flatPhoto.path,
      });
    }

    // --- The cache, before the allowance ---------------------------------
    const cacheKey = tryOnCacheKey(body, keyPieces);
    const shared = isSharedKey(body);

    let cachedQuery = db()
      .collection(COLLECTIONS.tryOns)
      .where('cacheKey', '==', cacheKey)
      .limit(1);
    if (!shared) {
      // Her own body: a key can only ever be hers, but scope the read
      // anyway so a key collision could never serve somebody else's
      // image.
      cachedQuery = db()
        .collection(COLLECTIONS.tryOns)
        .where('cacheKey', '==', cacheKey)
        .where('uid', '==', me.uid)
        .limit(1);
    }

    const cached = await cachedQuery.get();
    const hit = cached.docs[0];

    if (hit) {
      const existing = hit.data() as TryOn;
      const { used, total } = allowanceOf(settings?.tryOn);

      // A preset result generated by somebody else: she gets her own
      // document pointing at the same stored image, so her saved looks
      // and her deletions are hers alone and never touch another
      // student's row.
      if (existing.uid !== me.uid) {
        const ref = db().collection(COLLECTIONS.tryOns).doc();
        const mine: TryOn = {
          id: ref.id,
          uid: me.uid,
          bodyKind: 'preset',
          presetId: body.kind === 'preset' ? body.presetId : null,
          pieces,
          imagePath: existing.imagePath,
          cacheKey,
          saved: false,
          createdAt: now(),
          updatedAt: now(),
        } as unknown as TryOn;
        await ref.set(mine);
        return {
          tryOnId: ref.id,
          imagePath: existing.imagePath,
          cached: true,
          remaining: Math.max(total - used, 0),
        };
      }

      return {
        tryOnId: hit.id,
        imagePath: existing.imagePath,
        cached: true,
        remaining: Math.max(total - used, 0),
      };
    }

    // --- Only now does it cost anything -----------------------------------
    const { used, total } = allowanceOf(settings?.tryOn);
    if (used >= total) {
      // Phase 2 turns this into "buy more". Until then it says what is
      // true and nothing more.
      throw failed(TRYON_LIMIT_MESSAGE);
    }

    // --- Generate ---------------------------------------------------------
    let image =
      body.kind === 'preset'
        ? await presetImageDataUri(body.presetId)
        : await bodyPhotoDataUri(body.bodyPhotoPath);

    for (let i = 0; i < pieces.length; i += 1) {
      const listing = listingSnaps[i]!.data() as Listing;
      const garment = await garmentDataUri(listing.flatPhoto!);
      const result = await runTryOn({
        modelImage: image,
        garmentImage: garment,
        category: fashnCategories[i]!,
      });
      // Each result feeds the next call. This is what layering is.
      image = `data:image/jpeg;base64,${result}`;
    }

    const base64 = image.slice(image.indexOf(',') + 1);
    const ref = db().collection(COLLECTIONS.tryOns).doc();
    const imagePath = await storeResult(me.uid, ref.id, base64);

    const doc: TryOn = {
      id: ref.id,
      uid: me.uid,
      bodyKind: body.kind,
      presetId: body.kind === 'preset' ? body.presetId : null,
      pieces,
      imagePath,
      cacheKey,
      saved: false,
      createdAt: now(),
      updatedAt: now(),
    } as unknown as TryOn;

    // The document and the count together: a generation that is not
    // counted is a free one, and a count without a document is a charge
    // for nothing.
    const batch = db().batch();
    batch.set(ref, doc);
    batch.set(
      privateRef,
      { tryOn: { ...(settings?.tryOn ?? {}), generationsUsed: used + 1 }, updatedAt: now() },
      { merge: true },
    );
    await batch.commit();

    logger.info('Try-on generated', { uid: me.uid, pieces: pieces.length, cached: false });

    return { tryOnId: ref.id, imagePath, cached: false, remaining: Math.max(total - used - 1, 0) };
  },
);
