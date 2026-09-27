import type { Occasion, PostStatus } from '../constants';
import type {
  BaseDoc,
  CampusScoped,
  ImageRef,
  ListingSummary,
  Timestampish,
  UserSummary,
} from './common';

/**
 * `posts/{postId}`
 *
 * An outfit post — the social half of Loane. A post may tag listings, which
 * is the bridge from "cute outfit" to "rent this".
 */
export interface Post extends BaseDoc, CampusScoped {
  authorUid: string;
  author: UserSummary;

  photos: ImageRef[];
  caption: string;
  occasions: Occasion[];

  /**
   * Listings featured in this look. Denormalized so the tap-through target
   * renders instantly. `taggedListingIds` exists separately because Firestore
   * can only do array-contains queries on scalars.
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
  };

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
