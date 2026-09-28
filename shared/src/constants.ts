/**
 * Loane domain constants.
 *
 * These are the closed sets of values used across mobile, admin and the
 * backend. Anything stored in Firestore that is one of these must validate
 * against the list here — never hardcode a string somewhere else.
 */

// ---------------------------------------------------------------------------
// Occasions
// ---------------------------------------------------------------------------

export const OCCASIONS = [
  'gameday',
  'going_out',
  'formal',
  'date_function',
  'rush',
  'vacation',
  'wedding',
  'graduation',
] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const OCCASION_LABELS: Record<Occasion, string> = {
  gameday: 'Gameday',
  going_out: 'Going Out',
  formal: 'Formal',
  date_function: 'Date Function',
  rush: 'Rush',
  vacation: 'Vacation',
  wedding: 'Wedding',
  graduation: 'Graduation',
};

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

export const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
export type Size = (typeof SIZES)[number];

/** The sizing fields shown on a profile, in display order. */
export const SIZE_FIELDS = ['tops', 'bottoms', 'dresses', 'shoe'] as const;
export type SizeField = (typeof SIZE_FIELDS)[number];

export const SIZE_FIELD_LABELS: Record<SizeField, string> = {
  tops: 'Tops',
  bottoms: 'Bottoms',
  dresses: 'Dresses',
  shoe: 'Shoes',
};

export const SHOE_SIZES = [
  '5',
  '5.5',
  '6',
  '6.5',
  '7',
  '7.5',
  '8',
  '8.5',
  '9',
  '9.5',
  '10',
  '10.5',
  '11',
] as const;
export type ShoeSize = (typeof SHOE_SIZES)[number];

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  'dresses',
  'tops',
  'bottoms',
  'sets',
  'outerwear',
  'shoes',
  'bags',
  'accessories',
  'jewelry',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  dresses: 'Dresses',
  tops: 'Tops',
  bottoms: 'Bottoms',
  sets: 'Sets',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  bags: 'Bags',
  accessories: 'Accessories',
  jewelry: 'Jewelry',
};

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/** What the owner is willing to do with the garment. */
export const LISTING_INTENTS = ['rent', 'sell', 'both'] as const;
export type ListingIntent = (typeof LISTING_INTENTS)[number];

export const LISTING_STATUSES = [
  'draft',
  'active',
  /** Temporarily hidden by the owner. */
  'paused',
  /** Sold and no longer available. */
  'sold',
  /** Soft-deleted by the owner. */
  'removed',
  /** Taken down by an admin. */
  'suspended',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const CONDITIONS = ['new_with_tags', 'like_new', 'good', 'well_loved'] as const;
export type Condition = (typeof CONDITIONS)[number];

/** The only two rental durations we support at MVP. */
export const RENTAL_DURATIONS = [3, 7] as const;
export type RentalDuration = (typeof RENTAL_DURATIONS)[number];

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export const BOOKING_STATUSES = [
  /** Renter asked; lender has not answered. */
  'requested',
  /** Lender declined. Terminal. */
  'declined',
  /** Lender accepted and payment authorized. Dates are now blocked. */
  'confirmed',
  /** Lender handed the item over and the renter confirmed receipt. */
  'with_renter',
  /** Item came back and both sides confirmed. */
  'returned',
  /** Money settled, protection hold released, review window open. Terminal. */
  'completed',
  /** Called off by either side before handoff. Terminal. */
  'cancelled',
  /** A damage or non-return claim is open. */
  'disputed',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * Which statuses block a date range on the availability calendar.
 * A requested booking does NOT block — only a confirmed one does, so a lender
 * can receive several requests for the same weekend and pick one.
 */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = [
  'confirmed',
  'with_renter',
  'disputed',
];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: 'Requested',
  declined: 'Declined',
  confirmed: 'Confirmed',
  with_renter: 'With Renter',
  returned: 'Returned',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

/**
 * Who is allowed to make each move, and where it can go.
 *
 * This table IS the rules. Every booking function looks the move up here
 * before doing anything, so "can the renter mark her own booking
 * confirmed?" has exactly one answer in exactly one place.
 */
export const BOOKING_TRANSITIONS: Record<
  BookingStatus,
  { to: BookingStatus; by: 'lender' | 'renter' | 'either' | 'system' }[]
> = {
  requested: [
    { to: 'confirmed', by: 'lender' },
    { to: 'declined', by: 'lender' },
    // Nobody answered in time.
    { to: 'declined', by: 'system' },
    { to: 'cancelled', by: 'renter' },
  ],
  confirmed: [
    // The renter confirms she has the garment in her hands.
    { to: 'with_renter', by: 'renter' },
    { to: 'cancelled', by: 'either' },
  ],
  with_renter: [{ to: 'returned', by: 'either' }],
  returned: [
    // The lender has a window to flag a problem.
    { to: 'disputed', by: 'lender' },
    // Window passed with no flag.
    { to: 'completed', by: 'system' },
  ],
  // Terminal.
  declined: [],
  cancelled: [],
  completed: [],
  disputed: [],
};

/** Statuses where the rental has not yet been handed over. */
export const CANCELLABLE_STATUSES: readonly BookingStatus[] = ['requested', 'confirmed'];

/** Statuses that are over, one way or another. */
export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  'declined',
  'cancelled',
  'completed',
  'disputed',
];

/**
 * How long a lender has to answer a request.
 *
 * 48 hours, or the day before the rental starts, whichever comes first —
 * a request for this Saturday should not sit unanswered until Saturday.
 */
export const REQUEST_EXPIRY_HOURS = 48;

/**
 * How long after a return the lender has to flag a problem.
 *
 * Until this passes the booking stays `returned`. After it, with no flag,
 * it becomes `completed`. Matches DAMAGE_CLAIM_WINDOW_HOURS on purpose:
 * flagging a return is the front door to a damage claim.
 */
export const RETURN_DISPUTE_WINDOW_HOURS = 48;

/**
 * How an admin decided a flagged return.
 *
 * No money moves on any of these yet — Phase 5 is paused. When it
 * lands, `renter_at_fault` is what triggers a claim against the
 * protection hold. Until then a decision is a recorded judgement, which
 * still matters: the same name coming up twice is the real signal.
 */
export const DISPUTE_OUTCOMES = [
  'renter_at_fault',
  'lender_at_fault',
  'no_fault',
  'inconclusive',
] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];

export const DISPUTE_OUTCOME_LABELS: Record<DisputeOutcome, string> = {
  renter_at_fault: 'Renter at fault',
  lender_at_fault: 'Lender at fault',
  no_fault: 'Nobody at fault',
  inconclusive: 'Not enough evidence',
};

/** Why a lender flagged a return. Becomes a damage claim in Phase 5. */
export const RETURN_PROBLEMS = [
  'damaged',
  'not_returned',
  'excessive_cleaning',
  'wrong_item',
  'other',
] as const;
export type ReturnProblem = (typeof RETURN_PROBLEMS)[number];

export const RETURN_PROBLEM_LABELS: Record<ReturnProblem, string> = {
  damaged: 'It came back damaged',
  not_returned: "I never got it back",
  excessive_cleaning: 'It needs more than a normal clean',
  wrong_item: 'She returned the wrong thing',
  other: 'Something else',
};

/** A booking is either a rental or an outright purchase. */
export const BOOKING_KINDS = ['rental', 'purchase'] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const USER_ROLES = ['student', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ['active', 'suspended', 'deactivated'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * How a user proved she is a student.
 * At MVP we accept a campus email without emailing a code — see
 * docs/roadmap.md, "real campus verification" is a MUST-DO before beta.
 */
export const VERIFICATION_METHODS = [
  /** Typed a campus email; not yet proven. This is the MVP path. */
  'domain_claimed',
  /** Clicked a link or entered a code we emailed. */
  'email_confirmed',
  /** An admin verified her by hand. */
  'manual_admin',
] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export const REPORT_TARGET_TYPES = [
  'user',
  'listing',
  'post',
  'booking',
  'message',
  'comment',
  'review',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  'not_as_described',
  'no_show',
  'harassment',
  'inappropriate_content',
  'spam_or_scam',
  'counterfeit',
  'off_platform_payment',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'reviewing', 'actioned', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const CLAIM_TYPES = ['excessive_cleaning', 'repairable_damage', 'irreparable', 'not_returned'] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const CLAIM_STATUSES = [
  'submitted',
  'awaiting_renter_response',
  'under_review',
  'approved',
  'partially_approved',
  'denied',
  'withdrawn',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/**
 * How long she has to change a review after writing it.
 *
 * Long enough to fix a typo or reconsider in the cold light of day,
 * short enough that a rating cannot be quietly rewritten months later
 * to settle a score.
 */
export const REVIEW_EDIT_WINDOW_HOURS = 48;

export const REVIEW_MIN_RATING = 1;
export const REVIEW_MAX_RATING = 5;

/** Lenders have this long after a return to open a damage claim. */
export const DAMAGE_CLAIM_WINDOW_HOURS = 48;

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

export const POST_STATUSES = ['active', 'removed', 'suspended'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const FEED_TABS = ['explore', 'following'] as const;
export type FeedTab = (typeof FEED_TABS)[number];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  'rental_requested',
  'rental_accepted',
  'rental_declined',
  'booking_confirmed',
  'payment_confirmed',
  'rental_upcoming',
  'return_reminder',
  'return_confirmed',
  'new_follower',
  'post_liked',
  'new_message',
  'review_received',
  'claim_opened',
  'claim_resolved',
  'account_verified',
  'admin_notice',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ---------------------------------------------------------------------------
// Engagement events
// ---------------------------------------------------------------------------

/**
 * Every event we log from day one. These exist to answer the two MVP
 * questions: (1) will girls rent from closets on their campus, and
 * (2) does the social side drive discovery, engagement and return visits.
 */
export const EVENT_TYPES = [
  'app_open',
  'onboarding_step',
  'signup_completed',
  'profile_edit',
  'post_view',
  'post_like',
  'post_unlike',
  'post_save',
  'post_unsave',
  'post_create',
  'post_edit',
  'post_delete',
  'listing_view',
  'listing_create',
  'listing_edit',
  'listing_remove',
  'save',
  'unsave',
  'tagged_item_tap',
  'profile_view',
  'closet_view',
  'follow',
  'unfollow',
  'search',
  'filter_used',
  // The rental lifecycle stays in the past tense as a group — these
  // record something that happened to a booking, not a button press.
  'rental_requested',
  'rental_confirmed',
  'rental_declined',
  'rental_cancelled',
  'rental_handoff',
  'rental_received',
  'rental_returned',
  'rental_disputed',
  'message_sent',
  'comment_created',
  'comment_deleted',
  'post_shared',
  'invite_shared',
  'review_written',
  'report_submitted',
  'user_blocked',
  'user_unblocked',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Where in the app an event happened. Lets us compare social vs marketplace. */
export const EVENT_SURFACES = [
  'feed',
  'discover',
  'search',
  'profile',
  'closet',
  'listing',
  'post',
  'onboarding',
  'activity',
  'messages',
  'other',
] as const;
export type EventSurface = (typeof EVENT_SURFACES)[number];

// ---------------------------------------------------------------------------
// Limits and rules
// ---------------------------------------------------------------------------

export const LIMITS = {
  username: { min: 3, max: 30 },
  displayName: { min: 1, max: 40 },
  firstName: { min: 1, max: 40 },
  bio: { max: 200 },
  password: { min: 8 },
  listingName: { min: 2, max: 80 },
  listingDescription: { max: 1000 },
  brand: { max: 60 },
  postCaption: { max: 1000 },
  messageBody: { max: 2000 },
  commentBody: { min: 1, max: 500 },
  reportDetails: { max: 1000 },
  /** Photos per listing / per post. */
  listingPhotos: { min: 1, max: 8 },
  postPhotos: { min: 1, max: 6 },
  /** Listings a single post may tag. */
  taggedListings: { max: 6 },
  /** Upload constraints, enforced in Storage rules too. */
  imageBytes: 8 * 1024 * 1024,
  /** Longest edge after client-side resize, in pixels. */
  imageMaxEdge: 1600,
  /** Prices in whole US cents. */
  price: { minCents: 100, maxCents: 100_000 },
  garmentValue: { minCents: 1_000, maxCents: 500_000 },
  /** How far ahead a rental may be booked. */
  bookingHorizonDays: 180,
  /** People you can send one look to at a time. */
  sharePostRecipients: { max: 10 },
} as const;

/** Usernames that belong to Loane or would be confusing. */
export const RESERVED_USERNAMES = [
  'loane',
  'loaneapp',
  'admin',
  'support',
  'help',
  'team',
  'official',
  'security',
  'moderator',
  'mod',
  'staff',
  'about',
  'settings',
  'login',
  'signup',
  'api',
  'root',
  'me',
  'you',
] as const;

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * All money in Loane is stored as an integer number of US cents.
 * Never store money as a float.
 */
export const CURRENCY = 'usd' as const;

/**
 * Loane's cut of a rental, in basis points (1000 = 10%).
 *
 * TODO-DECIDE: who absorbs this — the renter on top of the rental price, the
 * lender out of the payout, or split. Zack to decide in Phase 5. The booking
 * document records the split explicitly so changing this later does not
 * rewrite history.
 */
export const PLATFORM_FEE_BPS = 1000;

/**
 * Protection hold placed on the renter's card, as a share of the documented
 * garment value, in basis points. Released after a successful return.
 * TODO-DECIDE in Phase 5.
 */
export const PROTECTION_HOLD_BPS = 10_000;
