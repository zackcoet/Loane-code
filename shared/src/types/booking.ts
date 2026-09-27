import type { BookingKind, BookingStatus, ClaimStatus, ClaimType } from '../constants';
import type {
  BaseDoc,
  CampusScoped,
  Cents,
  ImageRef,
  IsoDate,
  ListingSummary,
  Timestampish,
  UserSummary,
} from './common';

/**
 * `bookings/{bookingId}`
 *
 * A rental or a purchase. This collection is NEVER written directly by the
 * app — only by Cloud Functions, inside transactions. That is what makes
 * double-booking impossible.
 */
export interface Booking extends BaseDoc, CampusScoped {
  kind: BookingKind;
  status: BookingStatus;

  listingId: string;
  listing: ListingSummary;

  lenderUid: string;
  lender: UserSummary;
  renterUid: string;
  renter: UserSummary;

  /**
   * The rented dates. Start is the first day she has it; end is the day it
   * comes back and the item is free again. Null for a purchase.
   */
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  /** 3 or 7 for a rental. Null for a purchase. */
  durationDays: number | null;

  /**
   * The money, fixed at the moment the booking was created so that changing
   * our fee later never rewrites history.
   */
  amounts: {
    /** Rental price or sale price. */
    baseCents: Cents;
    /** Loane's cut. */
    platformFeeCents: Cents;
    /** What the renter is charged. */
    renterTotalCents: Cents;
    /** What the lender receives. */
    lenderPayoutCents: Cents;
    /** Hold placed on the renter's card, released after return. */
    protectionHoldCents: Cents;
    /**
     * Who absorbed the platform fee for this booking.
     * TODO-DECIDE (Phase 5): renter, lender or split.
     */
    feePaidBy: 'renter' | 'lender' | 'split';
  };

  /** TODO-PHASE5: Stripe references. Null until payments are built. */
  payment: {
    paymentIntentId: string | null;
    holdPaymentIntentId: string | null;
    transferId: string | null;
    refundId: string | null;
    /** Card authorized but not captured until the lender accepts. */
    authorizedAt: Timestampish | null;
    capturedAt: Timestampish | null;
    holdReleasedAt: Timestampish | null;
  };

  /** Free-text note the renter sends with her request. */
  renterMessage: string | null;

  /** Handoff. Kept deliberately simple for MVP — no QR, no dropbox. */
  handoff: {
    /** Where and when they agreed to meet. Plain text at MVP. */
    notes: string | null;
    /** Required: the lender photographs the garment at drop-off. */
    dropoffPhotos: ImageRef[];
    dropoffAt: Timestampish | null;
    /** Renter taps "I got it". */
    renterConfirmedReceiptAt: Timestampish | null;
    /** Photos at return, used to compare against drop-off. */
    returnPhotos: ImageRef[];
    renterConfirmedReturnAt: Timestampish | null;
    lenderConfirmedReturnAt: Timestampish | null;
  };

  /** Stamped as the booking moves through its states. */
  timeline: {
    requestedAt: Timestampish | null;
    respondedAt: Timestampish | null;
    confirmedAt: Timestampish | null;
    cancelledAt: Timestampish | null;
    completedAt: Timestampish | null;
  };

  cancelledByUid: string | null;
  cancellationReason: string | null;
  declineReason: string | null;

  /** Set while a damage claim is open. */
  activeClaimId: string | null;

  /** Whether each side has left a review yet. */
  reviews: {
    lenderReviewId: string | null;
    renterReviewId: string | null;
  };
}

/**
 * `damageClaims/{claimId}`
 *
 * Opened by a lender within 48 hours of return. Written only by Cloud
 * Functions; decided only by an admin.
 */
export interface DamageClaim extends BaseDoc, CampusScoped {
  bookingId: string;
  listingId: string;
  lenderUid: string;
  renterUid: string;

  type: ClaimType;
  status: ClaimStatus;
  description: string;
  /** Photos the lender submits as evidence. */
  evidencePhotos: ImageRef[];
  /** What the lender is asking for. Capped at the documented garment value. */
  requestedCents: Cents;

  /** The renter's side of the story. */
  renterResponse: string | null;
  renterResponsePhotos: ImageRef[];
  renterRespondedAt: Timestampish | null;

  /** Admin decision. */
  decision: {
    adminUid: string | null;
    awardedCents: Cents | null;
    notes: string | null;
    decidedAt: Timestampish | null;
  };

  /** Deadline for the lender to have filed. Used to reject late claims. */
  claimWindowEndsAt: Timestampish;
}

/**
 * `reviews/{reviewId}`
 *
 * Written only by a Cloud Function, and only by someone who completed the
 * booking being reviewed. That is what keeps ratings honest.
 */
export interface Review extends BaseDoc, CampusScoped {
  bookingId: string;
  listingId: string | null;
  /** Who wrote it. */
  authorUid: string;
  author: UserSummary;
  /** Who it is about. */
  subjectUid: string;
  /** Which side the author was on. */
  authorRole: 'lender' | 'renter';
  /** 1-5 whole stars. */
  rating: number;
  body: string;
  /** Hidden by an admin without deleting the record. */
  isHidden: boolean;
}
