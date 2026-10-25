import { type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  CATEGORIES,
  COLLECTIONS,
  CONDITIONS,
  LISTING_INTENTS,
  SHOE_SIZES,
  isOccasion,
  isSize,
  storagePaths,
  validateListingDraft,
  type Category,
  type Condition,
  type ImageRef,
  type Listing,
  type ListingIntent,
  type Occasion,
  type ShoeSize,
  type Size,
  type User,
} from '@loane/shared';
import { onCall } from '../lib/callable';
import { db, now } from '../lib/admin';
import { rateLimit } from '../lib/rateLimit';
import { alreadyTaken, failed, invalidArgument, notFound, permissionDenied } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { isDocId, isPlainObject } from '../lib/input';
import { isDownloadUrlFor, isSafePathUnder } from '../lib/downloadUrl';

/**
 * `writeListing` — Add to Closet and Edit Listing, both.
 *
 * WHY THIS MOVED OFF THE PHONE (run 40)
 *
 * Pieces used to be written straight from the app, with the database
 * rules checking the fields. Two things could not be checked that way:
 *
 *   - THE PHOTOS. A piece's photos are shown to her whole campus, so each
 *     must be a file she uploaded to Loane, in her own folder. Checking
 *     that for 8 photos plus a "Try it on" photo ran the rules out of
 *     steps (run 39), so a tampered app could show any picture from the
 *     internet on a piece.
 *   - HER NAME AND PHOTO on the piece (`owner`). The phone wrote its own
 *     copy and nothing checked it matched her profile, so a piece could
 *     appear under someone else's name.
 *
 * Here both are easy: `owner` is copied from her profile, and every new
 * photo is checked against her folder for THIS piece. A photo already on
 * the piece is kept as it is, so older pieces (and the seeded ones) stay
 * editable.
 *
 * The same checks as the form (`validateListingDraft`) run here; the
 * app's copy only exists to give a friendly message before uploading.
 * The database rules now refuse any piece written from the phone.
 *
 * NEW PIECES: the phone picks the id (it needs it for the photo folder
 * before anything is saved), and this refuses an id that already exists.
 * Sixty new pieces an hour; edits are not counted.
 */

/** Big enough for any phone camera, small enough to catch nonsense. */
const MAX_PHOTO_SIDE = 20_000;

/** The statuses she manages herself. Sold, suspended and removed are not hers to edit. */
const EDITABLE_STATUSES = ['draft', 'active', 'paused'] as const;

const PHOTO_PROBLEM = 'One of your photos did not upload properly. Try adding it again.';

export interface ListingInput {
  listingId: string;
  isNew: boolean;
  name: string;
  description: string;
  brand: string | null;
  category: Category;
  size: Size | null;
  shoeSize: ShoeSize | null;
  condition: Condition;
  occasions: Occasion[];
  intent: ListingIntent;
  oneDayCents: number | null;
  threeDayCents: number | null;
  sevenDayCents: number | null;
  salePriceCents: number | null;
  garmentValueCents: number | null;
  cleaningFeeCents: number | null;
  /** Not yet checked for ownership — see acceptPhoto. */
  photos: unknown[];
  flatPhoto: unknown;
  sameDay: boolean;
  availableNow: boolean;
}

interface WriteListingResult {
  listingId: string;
}

export const writeListing = onCall<unknown, Promise<WriteListingResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<unknown>): Promise<WriteListingResult> => {
    const owner = await requireVerifiedStudent(request);
    // Checked before the rate limit, so a broken form doesn't use up
    // one of her pieces for the hour.
    const input = parseListingInput(request.data);
    const ref = db().collection(COLLECTIONS.listings).doc(input.listingId);

    if (input.isNew) {
      await rateLimit(owner.uid, 'listing');
      const photos = input.photos.map((p) => acceptPhoto(p, owner.uid, input.listingId, []));
      const flatPhoto =
        input.flatPhoto == null
          ? null
          : acceptPhoto(input.flatPhoto, owner.uid, input.listingId, []);

      const listing = {
        id: input.listingId,
        campusId: owner.campusId,
        ownerUid: owner.uid,
        ...buildBody(input, owner, photos, flatPhoto, null),
        colorNames: [],
        blackoutDates: [],
        // MVP: every rental request needs the lender's approval.
        requiresApproval: true,
        stats: { viewCount: 0, saveCount: 0, tagCount: 0, completedRentals: 0 },
        suspendedReason: null,
        removedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      try {
        // create(), not set(): an id that already exists is refused, so
        // a new piece can never land on top of somebody else's.
        await ref.create(listing);
      } catch (error) {
        if ((error as { code?: number }).code === 6) {
          throw alreadyTaken('Something went wrong saving that piece. Try again.');
        }
        throw error;
      }
      logger.info('Listing created', { listingId: input.listingId, photos: photos.length });
      return { listingId: input.listingId };
    }

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw notFound('That piece is no longer on Loane.');
      const existing = snap.data() as Listing;
      if (existing.ownerUid !== owner.uid) {
        throw permissionDenied('You can only change your own pieces.');
      }
      if (!(EDITABLE_STATUSES as readonly string[]).includes(existing.status)) {
        throw failed("This piece can't be edited any more.");
      }

      const already = [
        ...(existing.photos ?? []),
        ...(existing.flatPhoto ? [existing.flatPhoto] : []),
      ];
      const photos = input.photos.map((p) => acceptPhoto(p, owner.uid, input.listingId, already));
      const flatPhoto =
        input.flatPhoto == null
          ? null
          : acceptPhoto(input.flatPhoto, owner.uid, input.listingId, already);

      // Counters, dates, history and admin fields are left exactly as
      // they are — only what the form shows is written.
      tx.update(ref, {
        ...buildBody(input, owner, photos, flatPhoto, existing.sameDay?.premiumBps ?? null),
        updatedAt: now(),
      });
    });
    logger.info('Listing edited', { listingId: input.listingId });
    return { listingId: input.listingId };
  },
);

/** The fields the form controls, the same for a new piece and an edit. */
function buildBody(
  input: ListingInput,
  owner: User,
  photos: ImageRef[],
  flatPhoto: ImageRef | null,
  premiumBps: number | null,
) {
  const rentable = input.intent === 'rent' || input.intent === 'both';
  const sellable = input.intent === 'sell' || input.intent === 'both';
  return {
    // From her profile, never from the phone.
    owner: {
      uid: owner.uid,
      username: owner.username,
      displayName: owner.displayName,
      photoUrl: owner.photoUrl,
      campusId: owner.campusId,
      isVerified: owner.isVerified,
    },
    name: input.name.trim(),
    description: input.description.trim(),
    brand: input.brand?.trim() || null,
    category: input.category,
    size: input.size,
    shoeSize: input.shoeSize,
    condition: input.condition,
    occasions: input.occasions,
    photos,
    coverUrl: photos[0]?.url ?? null,
    flatPhoto,
    // Her premium is kept as it was: the form has no control for it.
    sameDay: { enabled: input.sameDay, premiumBps },
    intent: input.intent,
    // "Available now" off means it is listed but not bookable yet.
    status: input.availableNow ? ('active' as const) : ('paused' as const),
    pricing: {
      oneDayCents: rentable ? input.oneDayCents : null,
      threeDayCents: rentable ? input.threeDayCents : null,
      sevenDayCents: rentable ? input.sevenDayCents : null,
    },
    cleaningFeeCents: rentable ? input.cleaningFeeCents : null,
    salePriceCents: sellable ? input.salePriceCents : null,
    garmentValueCents: input.garmentValueCents ?? 0,
  };
}

function optionalString(value: unknown, what: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw invalidArgument(`That ${what} did not come through.`);
  return value;
}

/** Null, or a whole number of cents. Never a float. */
function optionalCents(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw invalidArgument('Prices must be whole dollars and cents.');
  }
  return value;
}

/**
 * Everything the phone sent, checked, or a clear answer.
 *
 * The rules of a good piece are `validateListingDraft`'s — the same
 * function the form runs — so the two can never disagree.
 */
export function parseListingInput(data: unknown): ListingInput {
  const input = isPlainObject(data) ? data : {};

  if (!isDocId(input.listingId)) throw invalidArgument('That piece did not come through.');
  const isNew = input.isNew === true;

  const name = input.name ?? '';
  const description = input.description ?? '';
  if (typeof name !== 'string') throw invalidArgument('That name did not come through.');
  if (typeof description !== 'string') {
    throw invalidArgument('That description did not come through.');
  }
  const brand = optionalString(input.brand, 'brand');

  const category = input.category;
  if (typeof category !== 'string' || !(CATEGORIES as readonly string[]).includes(category)) {
    throw invalidArgument('Pick a category.');
  }
  const size = optionalString(input.size, 'size');
  if (size !== null && !isSize(size)) throw invalidArgument('Pick a valid size.');
  const shoeSize = optionalString(input.shoeSize, 'shoe size');
  if (shoeSize !== null && !(SHOE_SIZES as readonly string[]).includes(shoeSize)) {
    throw invalidArgument('Pick a valid shoe size.');
  }
  const condition = input.condition;
  if (typeof condition !== 'string' || !(CONDITIONS as readonly string[]).includes(condition)) {
    throw invalidArgument('Pick a condition.');
  }

  const rawOccasions = input.occasions ?? [];
  if (
    !Array.isArray(rawOccasions) ||
    !rawOccasions.every((o) => typeof o === 'string' && isOccasion(o))
  ) {
    throw invalidArgument('Pick valid occasions.');
  }
  // The same occasion twice would count twice in everyone's Discover.
  const occasions = [...new Set(rawOccasions as Occasion[])];

  const intent = input.intent;
  if (typeof intent !== 'string' || !(LISTING_INTENTS as readonly string[]).includes(intent)) {
    throw invalidArgument('Choose whether this is for rent, for sale, or both.');
  }

  const photos = input.photos ?? [];
  if (!Array.isArray(photos)) throw invalidArgument('Add at least one photo.');

  const parsed: ListingInput = {
    listingId: input.listingId,
    isNew,
    name,
    description,
    brand,
    category: category as Category,
    size: size as Size | null,
    shoeSize: shoeSize as ShoeSize | null,
    condition: condition as Condition,
    occasions,
    intent: intent as ListingIntent,
    oneDayCents: optionalCents(input.oneDayCents),
    threeDayCents: optionalCents(input.threeDayCents),
    sevenDayCents: optionalCents(input.sevenDayCents),
    salePriceCents: optionalCents(input.salePriceCents),
    garmentValueCents: optionalCents(input.garmentValueCents),
    cleaningFeeCents: optionalCents(input.cleaningFeeCents),
    photos,
    flatPhoto: input.flatPhoto ?? null,
    sameDay: input.sameDay === true,
    availableNow: input.availableNow !== false,
  };

  const check = validateListingDraft({
    name: parsed.name,
    description: parsed.description,
    brand: parsed.brand?.trim() || null,
    category: parsed.category,
    size: parsed.size,
    shoeSize: parsed.shoeSize,
    condition: parsed.condition,
    occasions: parsed.occasions,
    intent: parsed.intent,
    oneDayCents: parsed.oneDayCents,
    threeDayCents: parsed.threeDayCents,
    sevenDayCents: parsed.sevenDayCents,
    salePriceCents: parsed.salePriceCents,
    garmentValueCents: parsed.garmentValueCents,
    cleaningFeeCents: parsed.cleaningFeeCents,
    photoCount: photos.length,
  });
  if (!check.ok) throw invalidArgument(check.error ?? 'Something is missing.');

  return parsed;
}

/**
 * One photo of a piece: either one already on it (kept exactly as
 * stored), or a new upload in HER folder for THIS piece whose link is
 * that very file.
 */
export function acceptPhoto(
  value: unknown,
  uid: string,
  listingId: string,
  alreadyOnPiece: ImageRef[],
): ImageRef {
  if (!isPlainObject(value)) throw invalidArgument(PHOTO_PROBLEM);
  const { path, url, width, height, bytes } = value;

  const kept = alreadyOnPiece.find((p) => p.path === path && p.url === url);
  if (kept) return kept;

  const folder = storagePaths.listingPhoto(uid, listingId, '');
  if (!isSafePathUnder(path, folder)) throw invalidArgument(PHOTO_PROBLEM);
  if (typeof url !== 'string' || url.length > 2048 || !isDownloadUrlFor(url, path)) {
    throw invalidArgument(PHOTO_PROBLEM);
  }
  // Every phone lays the photo out from these, so a zero, a negative or
  // a NaN would break the piece on everyone's screen, not just hers.
  for (const side of [width, height]) {
    if (typeof side !== 'number' || !Number.isFinite(side) || side <= 0 || side > MAX_PHOTO_SIDE) {
      throw invalidArgument(PHOTO_PROBLEM);
    }
  }
  const photo: ImageRef = { path, url, width: width as number, height: height as number };
  if (typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0) photo.bytes = bytes;
  return photo;
}
