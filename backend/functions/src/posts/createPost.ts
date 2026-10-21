import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
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
  settings?: {
    hideLikeCount?: boolean;
    commentsDisabled?: boolean;
    sharingDisabled?: boolean;
    hideFromProfile?: boolean;
  };
  scheduledAt?: string | null;
}

interface CreatePostResult {
  postId: string;
}

export const createPost = onCall<CreatePostInput, Promise<CreatePostResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<CreatePostInput>): Promise<CreatePostResult> => {
    const author = await requireVerifiedStudent(request);
    await rateLimit(author.uid, 'post');
    const {
      photos = [],
      caption = '',
      occasions = [],
      settings = {},
      scheduledAt = null,
    } = request.data ?? {};
    const publishAt = parseScheduledAt(scheduledAt);
    const isScheduled = publishAt !== null;

    // --- Shape checks -----------------------------------------------------
    if (photos.length < LIMITS.postPhotos.min) throw invalidArgument('Add at least one photo.');
    if (photos.length > LIMITS.postPhotos.max) {
      throw invalidArgument(`You can add up to ${LIMITS.postPhotos.max} photos.`);
    }
    if (caption.length > LIMITS.postCaption.max) {
      throw invalidArgument(`Captions can be at most ${LIMITS.postCaption.max} characters.`);
    }
    if (occasions.some((o) => !isOccasion(o))) throw invalidArgument('Pick valid occasions.');

    const allTags = photos.flatMap((photo) => photo.tags ?? []);
    if (allTags.length > LIMITS.taggedListings.max) {
      throw invalidArgument(`You can tag up to ${LIMITS.taggedListings.max} pieces.`);
    }
    for (const tag of allTags) {
      // A coordinate outside the photo would render a dot in mid-air.
      if (!(tag.x >= 0 && tag.x <= 1 && tag.y >= 0 && tag.y <= 1)) {
        throw invalidArgument('A tag landed outside its photo. Try placing it again.');
      }
    }

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
      tags: (photo.tags ?? []).map((tag): PhotoTag => {
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
