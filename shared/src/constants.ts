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
/**
 * How long a piece can go out for.
 *
 * One day was added for the overnight case — a date function, one party —
 * which is most of what a campus actually rents for.
 */
export const RENTAL_DURATIONS = [1, 3, 7] as const;
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
    // "Got it back, all good." The handshake is renter-then-lender, so
    // a rental that went fine closes the moment the lender says so
    // rather than sitting in limbo for two days.
    { to: 'completed', by: 'lender' },
    // Window passed with no flag. The lender never has to do anything;
    // confirming just ends it sooner.
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
 * How long a lender or seller has to answer a request.
 *
 * 24 hours, or the day before the rental starts, whichever comes first —
 * a request for this Saturday should not sit unanswered until Saturday.
 *
 * Was 48. Ella's call: a day is long enough to be fair to someone with
 * classes, and two days is long enough for the renter to find something
 * else and stop caring.
 */
export const REQUEST_EXPIRY_HOURS = 24;

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
  not_returned: 'I never got it back',
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
  'item_damaged',
  'never_received',
  'item_not_returned',
  'item_stolen_or_lost',
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

export const SUPPORT_TOPICS = ['account_help', 'feedback', 'bug', 'other'] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const SUPPORT_REQUEST_STATUSES = ['open', 'resolved'] as const;
export type SupportRequestStatus = (typeof SUPPORT_REQUEST_STATUSES)[number];

export const CLAIM_TYPES = [
  'excessive_cleaning',
  'repairable_damage',
  'irreparable',
  'not_returned',
] as const;
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

export const POST_STATUSES = ['active', 'scheduled', 'removed', 'suspended'] as const;
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
  'review_requested',
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
  // --- AI try-on ---
  'tryon_open',
  /**
   * Records whether it was a cache hit. The hit rate is what decides
   * whether paid credits can ever work, so it is not optional metadata.
   */
  'tryon_generate',
  'tryon_save',
  'tryon_body_photo_set',
  'tryon_body_photo_delete',
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
  /** Anything reached from the try-on screen. */
  'tryon',
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
  supportMessage: { min: 1, max: 2000 },
  /** Photos per listing / per post. */
  listingPhotos: { min: 1, max: 8 },
  // 10 to match what the photo picker offers, and what Instagram
  // trained everyone to expect. Enforced in createPost as well as here,
  // so raising it is a deploy and not just a build.
  postPhotos: { min: 1, max: 10 },
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
 * Loane's cut, in basis points (2000 = 20%).
 *
 * THE LENDER PAYS IT, out of what she receives. The renter is charged the
 * price on the listing and nothing else — no line item, no "Loane fee" at
 * checkout. She pays $35, the lender receives $28.
 *
 * This REVERSES the 2026-10-05 decision, which had the renter paying 15%
 * on top. Ella's call, and it is the Depop shape. See docs/decisions.md
 * for the argument on both sides, including the one against: a lender who
 * wants $35 in hand will list at $44, so the prices renters see drift up
 * even though the checkout looks cleaner.
 *
 * No minimum fee any more. One was needed when the renter paid, to cover
 * Stripe's flat 30c; at 20% off the lender, anything above about $1.75
 * already clears Stripe, and a floor would take a brutal share of a cheap
 * rental out of the lender's pocket.
 */
export const PLATFORM_FEE_BPS = 2000;

/** Who absorbs the platform fee. The booking records its own copy. */
export const PLATFORM_FEE_PAID_BY = 'lender' as const;

/**
 * The most a renter can be charged for damage or non-return, as a share of
 * the value the lender documented for the piece. 10_000 bps = 100%.
 *
 * This is a CAP ON A LATER CHARGE, not money held on her card. Nothing is
 * ever held against garment value — see docs/decisions.md for why. She
 * agrees to this number explicitly before requesting, and it is only ever
 * charged if an admin rules her at fault on a claim.
 */
export const LIABILITY_CAP_BPS = 10_000;

// ---------------------------------------------------------------------------
// Same-day rentals
// ---------------------------------------------------------------------------

/**
 * What a renter pays on top to get a piece the same day, in basis points
 * of the rental price. 2500 = 25%.
 *
 * It splits 80/20 like the rental itself: the lender is being asked to
 * drop everything and drive, so she gets the bulk of it.
 */
export const SAME_DAY_PREMIUM_BPS = 2500;

/**
 * How long a lender has to answer a same-day request before it expires.
 *
 * TWO HOURS IS ONLY MEANINGFUL WITH PUSH NOTIFICATIONS. Until those land
 * (they need a development build — Expo Go cannot do push), this window
 * depends on her happening to open the app, and most same-day requests
 * will simply expire. The flow is built and correct; it is not yet good.
 */
export const SAME_DAY_RESPONSE_HOURS = 2;

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * The words Loane uses for its own verbs.
 *
 * Renting is "Loane It", buying is "Own It", and a piece that is out
 * right now is "On Loane". Ella's language, and it is half the brand —
 * the app should not say "rent" anywhere a student can see.
 *
 * They live here rather than inline so the vocabulary cannot drift: one
 * screen saying "Rent" while the rest says "Loane It" is exactly what a
 * constants file prevents. Grep for "Rent" in the mobile app before
 * adding a string; if it is user-facing it probably belongs here.
 */
export const WORDS = {
  /** The renting action. Replaces "Rent". */
  rent: 'Loane It',
  /** The buying action. Replaces "Buy". */
  buy: 'Own It',
  /** The call to action on a piece that is for sale. */
  buyCta: 'Become the owner',
  /** What a lender does when she adds a piece. */
  list: 'Put it on Loane',
  /** A piece that is out with a renter right now. */
  out: 'On Loane',
  /** The section that was called "Rentals". */
  rentals: 'On Loane',
} as const;

// ---------------------------------------------------------------------------
// Authorization lifetime
// ---------------------------------------------------------------------------

/**
 * How long a card authorization survives before the bank drops it.
 *
 * Stripe's limit, not ours. It matters because Loane authorizes at REQUEST
 * and captures at PICKUP, and a formal booked three weeks out would see its
 * authorization expire in between.
 */
export const AUTHORIZATION_VALID_DAYS = 7;

/**
 * How long before expiry we quietly re-authorize.
 *
 * Because we hold an off-session mandate on her card, a hold about to lapse
 * can be replaced without involving her. Surprising someone at the handoff
 * with "your payment expired" is a bad moment to discover this.
 */
export const REAUTHORIZE_BEFORE_EXPIRY_HOURS = 24;

// ---------------------------------------------------------------------------
// Cancellations
// ---------------------------------------------------------------------------

/**
 * Cancel at least this long before the start date and everything comes
 * back, fee included. A renter who cancels a week out cost nobody anything.
 */
export const FULL_REFUND_CUTOFF_HOURS = 48;

/**
 * Cancel inside the cutoff and the lender keeps this share of the rental.
 *
 * A lender who turned down other requests for a dress now sitting in her
 * closet on gameday is owed something. The Loane fee is always refunded —
 * we do not keep a cut of a rental that never happened.
 */
export const LATE_CANCEL_LENDER_SHARE_BPS = 5000;

// ---------------------------------------------------------------------------
// AI try-on
// ---------------------------------------------------------------------------

/** Preset bodies, labelled by build only. Never a name, never a number. */
export const TRYON_PRESETS = ['petite', 'medium', 'curve'] as const;

/** How those read in the UI. */
export const TRYON_PRESET_LABELS = {
  petite: 'Petite',
  medium: 'Medium',
  curve: 'Curve',
} as const;

/**
 * Our categories mapped to FASHN's three.
 *
 * ANYTHING ABSENT FROM THIS MAP CANNOT BE TRIED ON. That is how
 * underwear and swimwear are excluded — not by a filter somebody can
 * forget to apply, but by never being eligible in the first place.
 *
 * Outerwear is one of our categories and not one of FASHN's. It maps to
 * 'tops', and the rust bomber was the second-best result of the whole
 * Phase 0 test. Zack's call, 2026-10-12.
 */
export const TRYON_CATEGORY_MAP = {
  tops: 'tops',
  outerwear: 'tops',
  dresses: 'one-pieces',
} as const;

export type TryOnEligibleCategory = keyof typeof TRYON_CATEGORY_MAP;

/**
 * Shown with "Coming soon" rather than being silently absent, so
 * students can see where the feature is going.
 *
 * Bottoms desaturated and bled colour at the hem in both Phase 0
 * layering tests. Re-run the quality harness with flat garment photos
 * AND a body in fitted clothes before turning them on — both
 * conditions, or the retest tells us nothing.
 */
export const TRYON_COMING_SOON: Category[] = ['bottoms', 'shoes'];

/**
 * Free try-ons per account, FOR LIFE — not per week.
 *
 * Zack's call, 2026-10-12, replacing the plan's weekly allowance. A
 * lifetime cap is what protects the bill while paid credits are off;
 * when they are switched on this becomes the free tier rather than the
 * only tier.
 *
 * Only generations that actually cost money count against it. See
 * UserTryOn.generationsUsed.
 */
export const TRYON_FREE_LIFETIME = 5;

/** What she is told when she runs out, until credits exist. */
export const TRYON_LIMIT_MESSAGE =
  "You've used your 5 free try-ons, more coming soon";
