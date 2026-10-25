import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  LIMITS,
  isOccasion,
  type Listing,
  type Occasion,
  type PhotoTag,
  type Post,
  type PostPhoto,
  isTryOnReady,
} from '@loane/shared';
import { db, now, FieldValue, Timestamp } from '../lib/admin';
import { rateLimit } from '../lib/rateLimit';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { queueAutoFlag } from '../moderation/autoFlag';
import { isDocId, isPlainObject } from '../lib/input';

/**
 * `createPost`
 *
 * WHY THIS IS A FUNCTION WHEN LISTINGS ARE A DIRECT WRITE
 *
 * A listing only touches its own document, so the security rules can
 * validate it and the app can write it. A post cannot: tagging a garment
 * has to bump `tagCount` on a DIFFERENT document, and the flattened
 * `taggedListingIds` has to agree with the tags actually pinned to the
 * photos. Neither is something rules can do or the app can be trusted
 * with.
 *
 * So the whole thing happens here, in one transaction: validate the tags,
 * derive the flattened fields from them, write the post, move the
 * counters.
 *
 * TAGGING YOUR OWN CLOSET ONLY. Every tagged listing must belong to the
 * author. See docs/post-tagging.md for why, and for how this opens up
 * later — it is this check and nothing else.
 */

interface TagInput {
  listingId: string;
  /** Fraction of the photo, 0-1. Never pixels. */
  x: number;
  y: number;
}

interface PhotoInput {
  path: string;
  url: string;
  width: number;
  height: number;
  tags: TagInput[];
}

interface CreatePostInput {
  photos: PhotoInput[];
  caption: string;
  occasions: Occasion[];
  settings: {
    hideLikeCount?: boolean;
    commentsDisabled?: boolean;
    sharingDisabled?: boolean;
    hideFromProfile?: boolean;
  };
  scheduledAt: string | null;
}

interface CreatePostResult {
  postId: string;
}

export const createPost = onCall<unknown, Promise<CreatePostResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<unknown>): Promise<CreatePostResult> => {
    const author = await requireVerifiedStudent(request);
    // Checked before the rate limit, so a broken request doesn't use up
    // one of her posts for the hour.
    const { photos, caption, occasions, settings, scheduledAt } = parseInput(
      request.data,
      author.uid,
    );
    await rateLimit(author.uid, 'post');
    const publishAt = parseScheduledAt(scheduledAt);
    const isScheduled = publishAt !== null;

    const allTags = photos.flatMap((photo) => photo.tags);
    const uniqueIds = [...new Set(allTags.map((t) => t.listingId))];

    // --- Load the tagged listings and check they are hers ----------------
    const listings = new Map<string, Listing>();
    for (const listingId of uniqueIds) {
      const snap = await db().collection(COLLECTIONS.listings).doc(listingId).get();
      if (!snap.exists) throw notFound('One of the pieces you tagged is no longer listed.');

      const listing = snap.data() as Listing;
      if (listing.ownerUid !== author.uid) {
        // Launch rule. Relaxing it is this check and nothing else.
        throw failed('For now you can only tag pieces from your own closet.');
      }
      if (listing.status !== 'active') {
        throw failed(`"${listing.name}" isn't active, so it can't be tagged yet.`);
      }
      listings.set(listingId, listing);
    }

    // --- Build the document ----------------------------------------------
    const authorSummary = {
      uid: author.uid,
      username: author.username,
      displayName: author.displayName,
      photoUrl: author.photoUrl,
      campusId: author.campusId,
      isVerified: author.isVerified,
    };

    const builtPhotos: PostPhoto[] = photos.map((photo) => ({
      path: photo.path,
      url: photo.url,
      width: photo.width,
      height: photo.height,
      tags: photo.tags.map((tag): PhotoTag => {
        const listing = listings.get(tag.listingId)!;
        return {
          x: tag.x,
          y: tag.y,
          listingId: tag.listingId,
          ownerUid: listing.ownerUid,
          // A snapshot, so tapping a photo renders with no extra reads.
          label: {
            name: listing.name,
            coverUrl: listing.coverUrl,
            priceCents3Day: listing.pricing.threeDayCents,
            salePriceCents: listing.salePriceCents,
            ownerUsername: listing.owner.username,
            // So the feed can offer "Try this look on" without reading
            // every tagged listing of every post it renders.
            tryOnReady: isTryOnReady(listing),
          },
        };
      }),
    }));

    const ref = db().collection(COLLECTIONS.posts).doc();

    const post: Omit<Post, 'createdAt' | 'updatedAt'> = {
      id: ref.id,
      campusId: author.campusId,
      authorUid: author.uid,
      author: authorSummary,
      photos: builtPhotos,
      caption: caption.trim(),
      occasions,
      settings: {
        hideLikeCount: settings.hideLikeCount === true,
        commentsDisabled: settings.commentsDisabled === true,
        sharingDisabled: settings.sharingDisabled === true,
        hideFromProfile: settings.hideFromProfile === true,
      },
      scheduledAt: publishAt ? Timestamp.fromDate(publishAt) : null,
      // Derived here, never sent by the app, so they cannot disagree with
      // what is actually pinned to the photos.
      taggedListings: uniqueIds.map((listingId) => {
        const listing = listings.get(listingId)!;
        return {
          listingId,
          name: listing.name,
          coverUrl: listing.coverUrl,
          ownerUid: listing.ownerUid,
          priceCents3Day: listing.pricing.threeDayCents,
          salePriceCents: listing.salePriceCents,
        };
      }),
      taggedListingIds: uniqueIds,
      circleId: null,
      status: isScheduled ? 'scheduled' : 'active',
      stats: {
        likeCount: 0,
        saveCount: 0,
        viewCount: 0,
        tagTapCount: 0,
        commentCount: 0,
        shareCount: 0,
      },
      lastLiker: null,
      suspendedReason: null,
      removedAt: null,
    };

    const batch = db().batch();
    batch.set(ref, { ...post, createdAt: now(), updatedAt: now() });
    // Posted either way; a match only puts the caption in front of an admin.
    queueAutoFlag(batch, {
      targetType: 'post',
      targetId: ref.id,
      targetUid: author.uid,
      campusId: post.campusId,
      text: post.caption,
    });
    batch.update(db().collection(COLLECTIONS.users).doc(author.uid), {
      'stats.postCount': FieldValue.increment(1),
      updatedAt: now(),
    });
    for (const listingId of uniqueIds) {
      batch.update(db().collection(COLLECTIONS.listings).doc(listingId), {
        'stats.tagCount': FieldValue.increment(1),
      });
    }
    await batch.commit();

    logger.info('Post created', { postId: ref.id, tags: uniqueIds.length, scheduled: isScheduled });

    return { postId: ref.id };
  },
);

function parseScheduledAt(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw invalidArgument('Pick a valid schedule time.');

  const nowMs = Date.now();
  if (parsed.getTime() <= nowMs) return null;

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (parsed.getTime() > nowMs + thirtyDaysMs) {
    throw invalidArgument('Schedule posts within the next 30 days.');
  }

  return parsed;
}

/** Big enough for any phone camera, small enough to catch nonsense. */
const MAX_PHOTO_SIDE = 20_000;

/**
 * Everything the phone sent, checked, or a clear answer.
 *
 * A look's photos are shown to her whole campus, so each one has to be
 * a photo SHE uploaded to Loane: in her own folder in our storage, and
 * the link has to be that very file. Otherwise a tampered request could
 * put a picture from anywhere on the internet — or from someone else's
 * folder — in front of everyone, without the storage rules ever seeing
 * it.
 */
export function parseInput(data: unknown, uid: string): CreatePostInput {
  const input = isPlainObject(data) ? data : {};

  const rawPhotos = input.photos ?? [];
  if (!Array.isArray(rawPhotos)) throw invalidArgument('Add at least one photo.');
  if (rawPhotos.length < LIMITS.postPhotos.min) throw invalidArgument('Add at least one photo.');
  if (rawPhotos.length > LIMITS.postPhotos.max) {
    throw invalidArgument(`You can add up to ${LIMITS.postPhotos.max} photos.`);
  }
  const photos = rawPhotos.map((photo) => parsePhoto(photo, uid));

  const caption = input.caption ?? '';
  if (typeof caption !== 'string') throw invalidArgument('That caption did not come through.');
  if (caption.length > LIMITS.postCaption.max) {
    throw invalidArgument(`Captions can be at most ${LIMITS.postCaption.max} characters.`);
  }

  const rawOccasions = input.occasions ?? [];
  if (!Array.isArray(rawOccasions) || !rawOccasions.every(isOccasion)) {
    throw invalidArgument('Pick valid occasions.');
  }
  // The same occasion twice would count twice in everyone's For You.
  const occasions = [...new Set(rawOccasions as Occasion[])];

  const rawSettings = input.settings ?? {};
  if (!isPlainObject(rawSettings)) throw invalidArgument('Those settings did not come through.');

  const scheduledAt = input.scheduledAt ?? null;
  if (scheduledAt !== null && typeof scheduledAt !== 'string') {
    throw invalidArgument('Pick a valid schedule time.');
  }

  if (photos.flatMap((p) => p.tags).length > LIMITS.taggedListings.max) {
    throw invalidArgument(`You can tag up to ${LIMITS.taggedListings.max} pieces.`);
  }

  return { photos, caption, occasions, settings: rawSettings, scheduledAt };
}

function parsePhoto(value: unknown, uid: string): PhotoInput {
  const photoProblem = 'One of your photos did not upload properly. Try adding it again.';
  if (!isPlainObject(value)) throw invalidArgument(photoProblem);
  const { path, url, width, height } = value;

  if (
    typeof path !== 'string' ||
    path.length > 512 ||
    !path.startsWith(`users/${uid}/posts/`) ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw invalidArgument(photoProblem);
  }
  if (typeof url !== 'string' || url.length > 2048 || !isDownloadUrlFor(url, path)) {
    throw invalidArgument(photoProblem);
  }
  // Every phone lays the photo out from these, so a zero, a negative or
  // a NaN would break the look on everyone's feed, not just hers.
  for (const side of [width, height]) {
    if (typeof side !== 'number' || !Number.isFinite(side) || side <= 0 || side > MAX_PHOTO_SIDE) {
      throw invalidArgument(photoProblem);
    }
  }

  const rawTags = value.tags ?? [];
  if (!Array.isArray(rawTags)) throw invalidArgument('Those tags did not come through.');
  const tags = rawTags.map((tag): TagInput => {
    if (!isPlainObject(tag) || !isDocId(tag.listingId)) {
      throw invalidArgument('One of the pieces you tagged did not come through. Tag it again.');
    }
    const { x, y } = tag;
    // A coordinate outside the photo would render a dot in mid-air.
    if (typeof x !== 'number' || typeof y !== 'number' || !(x >= 0 && x <= 1 && y >= 0 && y <= 1)) {
      throw invalidArgument('A tag landed outside its photo. Try placing it again.');
    }
    return { listingId: tag.listingId, x, y };
  });

  return { path, url, width: width as number, height: height as number, tags };
}

/**
 * Is `url` the download link for `path` in this project's own bucket?
 *
 * Download links look like
 * `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path, encoded>?alt=media&token=…`.
 * Both bucket spellings are accepted: projects made after late 2024 use
 * `.firebasestorage.app`, older ones `.appspot.com`. On the emulators the
 * host is the laptop (seen from a phone, its wifi address), so only the
 * bucket and file are checked there.
 */
export function isDownloadUrlFor(url: string, path: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const onEmulator =
    process.env.FUNCTIONS_EMULATOR === 'true' || !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (onEmulator) {
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  } else if (parsed.protocol !== 'https:' || parsed.hostname !== 'firebasestorage.googleapis.com') {
    return false;
  }

  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
  const buckets = [
    process.env.STORAGE_BUCKET,
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
  ].filter((b): b is string => !!b && !!projectId);
  return buckets.some(
    (bucket) => parsed.pathname === `/v0/b/${bucket}/o/${encodeURIComponent(path)}`,
  );
}
