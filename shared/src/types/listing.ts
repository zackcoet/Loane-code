import type {
  Category,
  Condition,
  ListingIntent,
  ListingStatus,
  Occasion,
  Size,
  ShoeSize,
} from '../constants';
import type {
  BaseDoc,
  CampusScoped,
  Cents,
  ImageRef,
  IsoDate,
  Timestampish,
  UserSummary,
} from './common';

/**
 * `listings/{listingId}`
 *
 * One garment in someone's closet. The owner may create and edit her own;
 * availability and counters are written by Cloud Functions.
 */
export interface Listing extends BaseDoc, CampusScoped {
  ownerUid: string;
  /** Denormalized so a grid of listings renders in one read. */
  owner: UserSummary;

  name: string;
  description: string;
  brand: string | null;
  category: Category;
  /** Clothing size. Null for bags and most accessories. */
  size: Size | null;
  /** Set instead of `size` when category is "shoes". */
  shoeSize: ShoeSize | null;
  condition: Condition;
  /** Drives the occasion filters on Discover. */
  occasions: Occasion[];
  colorNames: string[];

  photos: ImageRef[];
  /** Convenience copy of photos[0].url. */
  coverUrl: string | null;

  intent: ListingIntent;
  status: ListingStatus;

  /** Set when intent is "rent" or "both". */
  pricing: {
    threeDayCents: Cents | null;
    sevenDayCents: Cents | null;
  };
  /** Set when intent is "sell" or "both". */
  salePriceCents: Cents | null;
  /**
   * What the piece is worth. Drives the protection hold and caps the renter's
   * liability in a damage claim. Required for every rentable listing.
   */
  garmentValueCents: Cents;

  /**
   * Whether the lender must approve each request. When false, a request is
   * confirmed as soon as payment authorizes.
   * TODO-PHASE4: instant book stays off for MVP; every request needs approval.
   */
  requiresApproval: boolean;

  /** Days the owner has manually marked unavailable (travel, her own event). */
  blackoutDates: IsoDate[];

  /**
   * Days already taken by a confirmed booking.
   *
   * Derived — a Cloud Function recomputes this from the bookings whenever
   * one changes. It is NOT the source of truth: `requestBooking` still
   * checks the bookings collection inside a transaction, which is what
   * actually makes double-booking impossible.
   *
   * It exists because a renter is not allowed to read other people's
   * bookings, so without it her calendar could not grey out a taken
   * weekend. This is the public shadow of a private collection: dates
   * only, no names, no prices, nothing about who has it.
   */
  bookedDates: IsoDate[];

  /** Counters, written by Cloud Functions. */
  stats: {
    viewCount: number;
    saveCount: number;
    /** Times this listing was tagged in a post. */
    tagCount: number;
    completedRentals: number;
  };

  /** Set when an admin takes the listing down. */
  suspendedReason: string | null;
  removedAt: Timestampish | null;
}

/**
 * `saves/{uid}_{listingId}`
 *
 * A wishlist entry. The compound id makes "did she save this" a single read
 * and makes double-saving impossible.
 */
export interface Save {
  id: string;
  uid: string;
  listingId: string;
  campusId: string;
  createdAt: Timestampish;
}
