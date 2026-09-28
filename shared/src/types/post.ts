import type { Occasion, PostStatus } from '../constants';
import type {
  BaseDoc,
  CampusScoped,
  Cents,
  ImageRef,
  ListingSummary,
  Timestampish,
  UserSummary,
} from './common';

/**
 * A tag pinned to a spot on one photo — the Instagram-style dot that
 * expands into a small label when you tap the picture.
 *
 * Built in Phase 3. The shape is settled now so nothing has to migrate.
 * See docs/post-tagging.md for how it works and why.
 */
export interface PhotoTag {
  /**
   * Where the dot sits, as a FRACTION of the photo: 0 is the left/top
   * edge, 1 is the right/bottom. Never pixels — the same photo renders at
   * a different size on every phone, and a pixel coordinate would drift
   * off the garment.
   */
  x: number;
  y: number;

  listingId: string;

  /**
   * Whose closet the piece comes from.
   *
   * At launch this ALWAYS equals the post's author: you may only tag your
   * own pieces. Storing it explicitly rather than assuming it is what lets
   * us allow tagging a friend's listing later without touching a single
   * stored document — only a security rule changes.
   */
  ownerUid: string;

  /**
   * A snapshot of what the label shows, so tapping a photo renders
   * instantly instead of firing one read per tag.
   *
   * This copy CAN go stale if the owner changes her price. That is a
   * deliberate trade: the label is for speed, and tapping it opens the
   * listing, which is always live. See docs/post-tagging.md.
   */
  label: {
    name: string;
    coverUrl: string | null;
    priceCents3Day: Cents | null;
    salePriceCents: Cents | null;
    ownerUsername: string;
  };
}

/** A post photo, which may carry tags. */
export interface PostPhoto extends ImageRef {
  tags: PhotoTag[];
}

/**
 * `posts/{postId}`
 *
 * An outfit post — the social half of Loane. A post may tag listings, which
 * is the bridge from "cute outfit" to "rent this".
 */
export interface Post extends BaseDoc, CampusScoped {
  authorUid: string;
  author: UserSummary;

  /**
   * Several photos per post, and each photo carries its own tags — a tag
   * belongs to the picture the garment appears in, not to the post.
   */
  photos: PostPhoto[];
  caption: string;
  occasions: Occasion[];

  /**
   * Every listing tagged anywhere in this post, flattened.
   *
   * `taggedListings` is the denormalized copy used to render a summary row.
   * `taggedListingIds` exists separately because Firestore's
   * `array-contains` only works on scalars — it is what powers "Seen in
   * posts" on a listing's page.
   *
   * Both are derived from the per-photo tags and are written by a Cloud
   * Function, so they cannot disagree with what is actually on the photos.
   */
  taggedListings: ListingSummary[];
  taggedListingIds: string[];

  /** TODO-PHASE3: set when the post is shared to a circle rather than campus-wide. */
  circleId: string | null;

  status: PostStatus;

  /** Counters, written by Cloud Functions. */
  stats: {
    likeCount: number;
    saveCount: number;
    viewCount: number;
    /** Taps from this post through to a tagged listing. The key MVP metric. */
    tagTapCount: number;
    commentCount: number;
    /** Times this look was sent to someone in a chat. */
    shareCount: number;
  };

  /**
   * The last person to like this look, for the "Liked by ... " line.
   *
   * Stored on the post rather than looked up, because otherwise every
   * post scrolling past the feed costs a likes query plus a profile
   * read just to print one name.
   *
   * Cleared when that same person un-likes: we do not know who liked it
   * before her, and showing the count alone is better than showing a
   * name belonging to somebody who took their like back.
   */
  lastLiker: UserSummary | null;

  suspendedReason: string | null;
  removedAt: Timestampish | null;
}

/**
 * `likes/{uid}_{postId}`
 *
 * Compound id prevents double-likes without a transaction.
 */
export interface Like {
  id: string;
  uid: string;
  postId: string;
  /** Denormalized so a function can credit the right author quickly. */
  postAuthorUid: string;
  campusId: string;
  createdAt: Timestampish;
}

/**
 * `postSaves/{uid}_{postId}`
 *
 * Saving a look, as opposed to saving a listing (`saves`).
 */
export interface PostSave {
  id: string;
  uid: string;
  postId: string;
  campusId: string;
  createdAt: Timestampish;
}

/**
 * `follows/{followerUid}_{followingUid}`
 *
 * One directional follow. Counters on both users are updated by a function.
 */
export interface Follow {
  id: string;
  followerUid: string;
  followingUid: string;
  campusId: string;
  createdAt: Timestampish;
}

/**
 * `circles/{circleId}`
 *
 * TODO-PHASE3+: a sorority, friend group or dorm. Designed now so posts and
 * feeds have somewhere to put a circle id. Not built for MVP.
 */
export interface Circle extends BaseDoc, CampusScoped {
  name: string;
  description: string;
  photoUrl: string | null;
  ownerUid: string;
  /** Whether anyone on campus may join or membership needs approval. */
  isOpen: boolean;
  memberCount: number;
}

/** TODO-PHASE3+: `circles/{circleId}/members/{uid}`. */
export interface CircleMember {
  uid: string;
  role: 'owner' | 'member';
  joinedAt: Timestampish;
}

/**
 * `comments/{commentId}`
 *
 * A comment on a look.
 *
 * Top-level rather than nested under the post, because the admin tools
 * need to sweep every comment on the platform and a collection-group
 * query needs an index of its own where a plain collection does not.
 *
 * Soft-deleted like everything else: `removed` is what she chose,
 * `suspended` is what an admin did, and the row survives either way.
 */
export interface Comment extends BaseDoc, CampusScoped {
  postId: string;
  authorUid: string;
  author: UserSummary;
  body: string;

  /**
   * The comment this one answers, or null for a top-level comment.
   *
   * ONE LEVEL ONLY. A reply cannot itself be replied to — the server
   * refuses a parent that already has a parent. Arbitrary nesting turns
   * a comment section into a thread you have to navigate, and on a
   * phone the indentation runs out after two levels anyway.
   */
  parentCommentId: string | null;

  status: 'active' | 'removed' | 'suspended';
  /** Set when an admin takes it down. */
  suspendedReason: string | null;
}
