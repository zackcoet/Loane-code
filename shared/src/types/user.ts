import type { AccountStatus, Size, ShoeSize, UserRole, VerificationMethod } from '../constants';
import type { BaseDoc, CampusScoped, Timestampish } from './common';
import type { LegalAcceptance } from './legal';

/**
 * `users/{uid}`
 *
 * The uid is the Firebase Auth uid. A user may edit a narrow set of her own
 * fields; everything about verification, roles, counts and moderation is
 * written only by Cloud Functions.
 */
export interface User extends BaseDoc, CampusScoped {
  /** Firebase Auth uid. Same as the document id. */
  uid: string;

  // --- Identity -----------------------------------------------------------
  /** Lowercase, unique across all of Loane. Mirrored in `usernames/{username}`. */
  username: string;
  firstName: string;
  displayName: string;
  bio: string;
  photoUrl: string | null;

  // --- Campus verification ------------------------------------------------
  /**
   * Whether we consider her a verified student.
   *
   * At MVP this is set true as soon as her campus email matches an approved
   * domain — we do not yet email a code. See docs/roadmap.md: sending a real
   * confirmation is a MUST-DO before beta launch. Nothing is gated on this
   * flag yet, but everything that should be gated later reads it.
   */
  isVerified: boolean;
  verificationMethod: VerificationMethod | null;
  verifiedAt: Timestampish | null;

  /**
   * Whether we have PROVEN she controls that inbox.
   *
   * Deliberately separate from `isVerified`, because the two answer
   * different questions:
   *
   *   isVerified     — her domain is on the approved list, so she may use
   *                    the app. True from the moment she signs up.
   *   emailConfirmed — we sent something to that address and she proved she
   *                    received it. Always false today.
   *
   * We do not email a link: university security scanners follow links in
   * incoming mail, which silently burns a one-time link before the student
   * ever sees it. The plan is a 6-digit code she types back in.
   *
   * Nothing reads this field yet. When we ship the code, it flips to true
   * and we start enforcing it — no documents have to be migrated. Listed as
   * launch-blocking in docs/roadmap.md.
   */
  emailConfirmed: boolean;
  emailConfirmedAt: Timestampish | null;

  // --- Sizing --------------------------------------------------------------
  /**
   * Whether her sizes appear on her public profile.
   *
   * OFF unless she turns it on. Her sizes are useful to a renter
   * judging fit, but they are also a fact about her body on a page
   * anyone at her school can open, and that is not a thing to publish
   * on somebody's behalf by default.
   *
   * She still fills them in either way — they are what "will this fit
   * me?" is answered from when she is the one renting.
   */
  showSizes: boolean;

  sizes: {
    tops: Size | null;
    bottoms: Size | null;
    dresses: Size | null;
    shoe: ShoeSize | null;
  };

  // --- Account ------------------------------------------------------------
  /** Elevated to "admin" only via a Firebase custom claim, never by the app. */
  role: UserRole;
  status: AccountStatus;
  /** Set by an admin when suspending. */
  suspendedReason: string | null;
  suspendedUntil: Timestampish | null;

  /** True for the 10-20 seeded launch closets. Used by the admin tracker. */
  isFoundingCloset: boolean;

  /** Which published legal versions she agreed to, and when. */
  legalAccepted: LegalAcceptance;

  // --- Counters, all written by Cloud Functions ---------------------------
  stats: {
    followerCount: number;
    followingCount: number;
    listingCount: number;
    postCount: number;
    /** Completed rentals where she was the lender. */
    rentalsAsLender: number;
    /** Completed rentals where she was the renter. */
    rentalsAsRenter: number;
    /** Average of reviews left about her, 1-5. Null until her first review. */
    ratingAverage: number | null;
    ratingCount: number;
    /**
     * Rentals she called off, on either side.
     *
     * One is life. Five in a month is a lender nobody can rely on, and
     * the admin dashboard surfaces it so that is visible before it
     * becomes a reputation problem.
     */
    cancellations: number;
  };

  // --- Activity -----------------------------------------------------------
  lastActiveAt: Timestampish | null;
  /** Expo push tokens, one per device. Written by the app for itself only. */
  pushTokens: string[];

  /**
   * TODO-PHASE5: Stripe Connect. Left null until Phase 5 so the shape is
   * settled now and we are not migrating documents later.
   */
  /**
   * Stripe. Written only by Cloud Functions and the Stripe webhook —
   * never by the app. If the phone could set `payoutsEnabled` it could
   * accept paid rentals with nowhere to send the money.
   */
  stripe: {
    /** Connected account id for receiving payouts. */
    accountId: string | null;
    /** Customer id for charging her card as a renter. */
    customerId: string | null;
    /** The saved card we charge off-session for claims. */
    defaultPaymentMethodId: string | null;
    /** True once Stripe says onboarding is finished and payouts can run. */
    payoutsEnabled: boolean;
    /** She started onboarding but has not finished it. */
    onboardingStartedAt: Timestampish | null;
    /**
     * Which Stripe platform account the ids above belong to.
     *
     * Connect accounts and customers are owned by the platform that created
     * them, so if Loane ever moves to a different Stripe account these ids
     * silently stop resolving. Recording the platform means the mismatch is
     * detectable, and she can be asked to reconnect instead of hitting an
     * error nobody can explain.
     */
    platformAccountId: string | null;
  };
}

/**
 * `usernames/{username}`
 *
 * A tiny lock document. Creating one inside a transaction is what makes a
 * username unique — Firestore cannot enforce uniqueness on a field.
 * Written only by Cloud Functions.
 */
export interface UsernameLock {
  /** Lowercase username. Same as the document id. */
  username: string;
  uid: string;
  createdAt: Timestampish;
}

/**
 * `users/{uid}/private/settings`
 *
 * Things only she (and admins) may read: contact details, notification
 * preferences, handoff instructions. Kept out of the public profile.
 */
export interface UserPrivate {
  uid: string;
  /** The email she signed up with, which may not be her campus email. */
  accountEmail: string;
  /**
   * The campus email she signed up with. Lowercased.
   *
   * THIS IS NOT PUBLIC. It used to sit on the user document, which any
   * signed-in student could read — meaning every student could read
   * every other student's school address. On a campus app that is how
   * somebody gets found by a person they are avoiding.
   *
   * It lives here because Firestore rules are all-or-nothing per
   * document: there is no way to hide one field of a readable doc, so
   * the field has to move. Written only by Cloud Functions — her campus
   * claim rests on this address, so she must not be able to edit it
   * even though she can edit the rest of this document.
   */
  campusEmail: string | null;
  phone: string | null;
  /** Free text she gives a renter about where to meet, e.g. a dorm lobby. */
  handoffNotes: string | null;
  notificationPreferences: {
    pushEnabled: boolean;
    rentals: boolean;
    social: boolean;
    messages: boolean;
    marketing: boolean;
  };
  updatedAt: Timestampish;
}

/**
 * `users/{uid}/blocked/{blockedUid}`
 *
 * TODO-PHASE6: blocking is separate from reporting. A block hides both users
 * from each other's feed, search, profile and messages. Designed now, built
 * in Phase 6.
 */
export interface BlockedUser {
  blockedUid: string;
  createdAt: Timestampish;
}
