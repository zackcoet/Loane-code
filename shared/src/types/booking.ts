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
    /**
     * The most the renter can be charged if a damage or non-return claim is
     * approved against her — the value the lender documented for the piece.
     *
     * Nothing is held on her card for this. It is a ceiling on a possible
     * later charge, and she agrees to the number before requesting.
     */
    liabilityCapCents: Cents;
    /** Who absorbed the platform fee for this booking. */
    feePaidBy: 'renter' | 'lender' | 'split';
  };

  /**
   * Stripe references and the money's timeline.
   *
   * The shape follows the real sequence: authorize when she requests,
   * capture when she picks the piece up, pay the lender when the rental
   * closes. An authorization can be replaced before pickup if it is about
   * to lapse, so `paymentIntentId` is whichever one is currently live.
   */
  payment: {
    /** The live authorization, or the captured charge once picked up. */
    paymentIntentId: string | null;
    /** Set when the lender's share is sent to her Connect account. */
    transferId: string | null;
    refundId: string | null;
    refundedCents: Cents | null;

    /** Held at request. */
    authorizedAt: Timestampish | null;
    /**
     * When the bank will drop the current authorization. Watched by the
     * sweep so a hold is replaced rather than discovered dead at handoff.
     */
    authorizationExpiresAt: Timestampish | null;
    /** How many times we have had to replace a lapsing authorization. */
    reauthorizedCount: number;

    /** Taken at pickup, when she confirms she has the piece. */
    capturedAt: Timestampish | null;
    /** Sent to the lender once the rental completed. */
    paidOutAt: Timestampish | null;

    /**
     * Her explicit agreement to the liability cap, captured before the
     * request goes in. Stored as both a time and the exact number shown,
     * because "she agreed to $200" has to survive the listing being edited.
     */
    liabilityAgreedAt: Timestampish | null;
    liabilityAgreedCapCents: Cents | null;

    /** Set only if an admin ruled her at fault on a claim. */
    claimPaymentIntentId: string | null;
    claimChargedCents: Cents | null;
    /** An off-session charge can be declined. The claim stays open if so. */
    claimChargeFailedAt: Timestampish | null;
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

  /**
   * When an unanswered request goes stale. 48 hours after it was made, or
   * the day before the rental starts, whichever comes first.
   */
  expiresAt: Timestampish | null;

  /**
   * How long the lender has to flag a problem after a return. Until this
   * passes the booking stays `returned`; after it, with no flag, a
   * scheduled function marks it `completed`.
   */
  disputeWindowEndsAt: Timestampish | null;

  /** Why the lender flagged the return, when she did. */
  returnProblem: {
    type: string;
    note: string;
    photos: ImageRef[];
    flaggedAt: Timestampish;
  } | null;

  /** How an admin decided a flagged return. */
  disputeResolution: {
    outcome: string;
    notes: string;
    adminUid: string;
    decidedAt: Timestampish;
  } | null;

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
