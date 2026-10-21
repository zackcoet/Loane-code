import {
  CATEGORIES,
  LIMITS,
  OCCASIONS,
  RENTAL_DURATIONS,
  RESERVED_USERNAMES,
  SIZES,
  TRYON_CATEGORY_MAP,
  type Category,
  type Occasion,
  type RentalDuration,
  type Size,
} from './constants';
import { DELETED_USERNAME_PREFIX } from './accountDeletion';
import { daysBetween, isIsoDate } from './dates';
import type { Cents, DateRange, ImageRef } from './types/common';
import type { Listing } from './types/listing';

/**
 * Validation shared by the app, the admin dashboard and Cloud Functions.
 *
 * The client uses these to show friendly errors. The server uses the exact
 * same functions to actually enforce them — never trust the client.
 */

export interface ValidationResult {
  ok: boolean;
  /** Human-readable, safe to show in the UI. */
  error?: string;
}

const OK: ValidationResult = { ok: true };
const fail = (error: string): ValidationResult => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

const USERNAME_PATTERN = /^[a-z0-9._]+$/;

/** Usernames are lowercase letters, numbers, dots and underscores. */
export function validateUsername(raw: string): ValidationResult {
  const username = raw.trim().toLowerCase();
  if (username.length < LIMITS.username.min) {
    return fail(`Usernames need at least ${LIMITS.username.min} characters.`);
  }
  if (username.length > LIMITS.username.max) {
    return fail(`Usernames can be at most ${LIMITS.username.max} characters.`);
  }
  if (!USERNAME_PATTERN.test(username)) {
    return fail('Usernames can use letters, numbers, periods and underscores.');
  }
  if (username.startsWith('.') || username.endsWith('.')) {
    return fail('Usernames cannot start or end with a period.');
  }
  if (username.includes('..')) {
    return fail('Usernames cannot contain two periods in a row.');
  }
  if ((RESERVED_USERNAMES as readonly string[]).includes(username)) {
    return fail('That username is reserved.');
  }
  // Deleted accounts are renamed deleted_<id> (see accountDeletion.ts).
  // Nobody may pick one, or she could pose as somebody who left.
  if (username.startsWith(DELETED_USERNAME_PREFIX)) {
    return fail('That username is reserved.');
  }
  return OK;
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(raw: string): ValidationResult {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return fail('Enter a valid email address.');
  return OK;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The part after the "@", lowercased. */
export function emailDomain(raw: string): string | null {
  const at = raw.lastIndexOf('@');
  if (at === -1 || at === raw.length - 1) return null;
  return raw.slice(at + 1).trim().toLowerCase();
}

/**
 * Does this email belong to an approved campus?
 *
 * At MVP a match here is all it takes to be marked verified — we do not yet
 * email a confirmation. See docs/roadmap.md.
 */
export function matchesCampusDomain(email: string, approvedDomains: string[]): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  return approvedDomains.some((d) => domain === d.toLowerCase());
}

export function validatePassword(password: string): ValidationResult {
  if (password.length < LIMITS.password.min) {
    return fail(`Use at least ${LIMITS.password.min} characters.`);
  }
  return OK;
}

export function validateDisplayName(raw: string): ValidationResult {
  const name = raw.trim();
  if (name.length < LIMITS.displayName.min) return fail('Enter a name.');
  if (name.length > LIMITS.displayName.max) {
    return fail(`Names can be at most ${LIMITS.displayName.max} characters.`);
  }
  return OK;
}

export function validateBio(raw: string): ValidationResult {
  if (raw.length > LIMITS.bio.max) {
    return fail(`Bios can be at most ${LIMITS.bio.max} characters.`);
  }
  return OK;
}

/**
 * A US mobile number, stored as E.164: `+15551234567`.
 *
 * ONE normalizer, because three different things depend on these
 * strings matching each other exactly: the number she types here, the
 * number a lender is shown when a handoff is arranged, and — once
 * contact matching exists — the hash we compare against. Two
 * normalizers would mean two people with the same phone never match.
 *
 * US only, which is the launch campus. A number that is already in
 * E.164 with a different country code is kept as typed rather than
 * mangled into a +1, so the field is not actively wrong for an
 * international student; we simply cannot check it.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+') && !trimmed.startsWith('+1')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return digits.length > 0 ? `+${digits}` : '';
}

export function validatePhone(raw: string): ValidationResult {
  const trimmed = raw.trim();
  // Empty is fine. A phone number is optional everywhere it is asked
  // for, and clearing it is how she takes it back.
  if (trimmed.length === 0) return OK;

  if (trimmed.startsWith('+') && !trimmed.startsWith('+1')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? OK : fail('Enter a valid phone number.');
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) return OK;
  return fail('Enter a 10-digit US phone number.');
}

/** `+15551234567` back to `(555) 123-4567` for display. */
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isSize(value: string): value is Size {
  return (SIZES as readonly string[]).includes(value);
}

export function isOccasion(value: string): value is Occasion {
  return (OCCASIONS as readonly string[]).includes(value);
}

export function isRentalDuration(value: number): value is RentalDuration {
  return (RENTAL_DURATIONS as readonly number[]).includes(value);
}

export function validatePriceCents(cents: Cents, label = 'Price'): ValidationResult {
  if (!Number.isInteger(cents)) return fail(`${label} must be a whole number of cents.`);
  if (cents < LIMITS.price.minCents) {
    return fail(`${label} must be at least $${LIMITS.price.minCents / 100}.`);
  }
  if (cents > LIMITS.price.maxCents) {
    return fail(`${label} must be under $${LIMITS.price.maxCents / 100}.`);
  }
  return OK;
}

export function validateGarmentValueCents(cents: Cents): ValidationResult {
  if (!Number.isInteger(cents)) return fail('Garment value must be a whole number of cents.');
  if (cents < LIMITS.garmentValue.minCents) {
    return fail(`Garment value must be at least $${LIMITS.garmentValue.minCents / 100}.`);
  }
  if (cents > LIMITS.garmentValue.maxCents) {
    return fail(`Garment value must be under $${LIMITS.garmentValue.maxCents / 100}.`);
  }
  return OK;
}

export function validateListingName(raw: string): ValidationResult {
  const name = raw.trim();
  if (name.length < LIMITS.listingName.min) return fail('Give the piece a name.');
  if (name.length > LIMITS.listingName.max) {
    return fail(`Item names can be at most ${LIMITS.listingName.max} characters.`);
  }
  return OK;
}

export function validatePhotoCount(count: number, kind: 'listing' | 'post'): ValidationResult {
  const limit = kind === 'listing' ? LIMITS.listingPhotos : LIMITS.postPhotos;
  if (count < limit.min) return fail('Add at least one photo.');
  if (count > limit.max) return fail(`You can add up to ${limit.max} photos.`);
  return OK;
}

/**
 * Everything the Add to Closet screen collects, before it becomes a
 * Listing document.
 */
export interface ListingDraft {
  name: string;
  description: string;
  brand: string | null;
  category: Category | null;
  size: Size | null;
  shoeSize: string | null;
  condition: string | null;
  occasions: Occasion[];
  intent: 'rent' | 'sell' | 'both' | null;
  oneDayCents: Cents | null;
  threeDayCents: Cents | null;
  sevenDayCents: Cents | null;
  salePriceCents: Cents | null;
  cleaningFeeCents: Cents | null;
  garmentValueCents: Cents | null;
  photoCount: number;
}

/**
 * Validates a whole listing in one pass, in the order the fields appear on
 * screen, so the first error she sees is the first thing she can fix.
 *
 * The SAME rules are re-stated in firestore.rules, because security rules
 * cannot call TypeScript. That duplication is deliberate and load-bearing:
 * this function gives a friendly message, the rules make it true. If you
 * change one, change the other — there is a test that a listing missing a
 * required field is rejected by the rules.
 */
export function validateListingDraft(draft: ListingDraft): ValidationResult {
  const photos = validatePhotoCount(draft.photoCount, 'listing');
  if (!photos.ok) return photos;

  const name = validateListingName(draft.name);
  if (!name.ok) return name;

  if (draft.description.length > LIMITS.listingDescription.max) {
    return fail(`Descriptions can be at most ${LIMITS.listingDescription.max} characters.`);
  }
  if (draft.brand && draft.brand.length > LIMITS.brand.max) {
    return fail(`Brand names can be at most ${LIMITS.brand.max} characters.`);
  }

  if (!draft.category) return fail('Pick a category.');
  if (!isCategory(draft.category)) return fail('Pick a valid category.');

  // Shoes are sized differently; everything else uses XS-XL. Bags and most
  // accessories have no size at all.
  const needsClothingSize = !['shoes', 'bags', 'accessories', 'jewelry'].includes(draft.category);
  if (needsClothingSize && !draft.size) return fail('Pick a size.');
  if (draft.size && !isSize(draft.size)) return fail('Pick a valid size.');

  if (draft.occasions.length === 0) {
    return fail('Pick at least one occasion so people can find it.');
  }
  if (draft.occasions.some((o) => !isOccasion(o))) return fail('Pick valid occasions.');

  if (!draft.intent) return fail('Choose whether this is for rent, for sale, or both.');

  const rentable = draft.intent === 'rent' || draft.intent === 'both';
  const sellable = draft.intent === 'sell' || draft.intent === 'both';

  if (rentable) {
    if (draft.oneDayCents == null) return fail('Set a 1-day price.');
    const one = validatePriceCents(draft.oneDayCents, '1-day price');
    if (!one.ok) return one;

    if (draft.threeDayCents == null) return fail('Set a 3-day price.');
    const three = validatePriceCents(draft.threeDayCents, '3-day price');
    if (!three.ok) return three;

    if (draft.sevenDayCents == null) return fail('Set a 7-day price.');
    const seven = validatePriceCents(draft.sevenDayCents, '7-day price');
    if (!seven.ok) return seven;

    // None of these are hard rules of the world, but a longer rental
    // priced below a shorter one is almost always a typo, and it would
    // quietly cost her money on every booking.
    if (draft.threeDayCents < draft.oneDayCents) {
      return fail('The 3-day price is lower than the 1-day price. Is that right?');
    }
    if (draft.sevenDayCents < draft.threeDayCents) {
      return fail('The 7-day price is lower than the 3-day price. Is that right?');
    }
  }

  // Optional, but if she sets one it has to be a real amount. A cleaning
  // fee larger than the rental itself is a typo, not a policy.
  if (draft.cleaningFeeCents != null) {
    const cleaning = validatePriceCents(draft.cleaningFeeCents, 'Cleaning fee');
    if (!cleaning.ok) return cleaning;
    if (draft.threeDayCents != null && draft.cleaningFeeCents > draft.threeDayCents) {
      return fail('The cleaning fee is more than the 3-day price. Is that right?');
    }
  }

  if (sellable) {
    if (draft.salePriceCents == null) return fail('Set a sale price.');
    const sale = validatePriceCents(draft.salePriceCents, 'Sale price');
    if (!sale.ok) return sale;
  }

  if (rentable) {
    if (draft.garmentValueCents == null) {
      return fail("Set what the piece is worth — it's what protects you if it's damaged.");
    }
    const value = validateGarmentValueCents(draft.garmentValueCents);
    if (!value.ok) return value;

    if (draft.threeDayCents != null && draft.garmentValueCents < draft.threeDayCents) {
      return fail('The garment value should be more than the rental price.');
    }
  }

  return OK;
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/**
 * Check a requested rental window on its own terms. This does NOT check for
 * conflicts with other bookings — only a Cloud Function running inside a
 * transaction may do that.
 */
export function validateDateRange(range: DateRange, today: string): ValidationResult {
  if (!isIsoDate(range.startDate) || !isIsoDate(range.endDate)) {
    return fail('Pick valid dates.');
  }
  if (range.startDate < today) return fail('Pick a start date in the future.');
  if (range.endDate <= range.startDate) return fail('The return date must be after the start date.');

  const days = daysBetween(range.startDate, range.endDate);
  if (!isRentalDuration(days)) {
    return fail(`Rentals are ${RENTAL_DURATIONS.join(' or ')} days.`);
  }
  if (daysBetween(today, range.startDate) > LIMITS.bookingHorizonDays) {
    return fail(`You can book up to ${LIMITS.bookingHorizonDays} days ahead.`);
  }
  return OK;
}

/**
 * Can this piece be tried on?
 *
 * TWO CONDITIONS, AND BOTH MATTER. It needs a lay-it-flat photo —
 * without one a try-on renders the wrong garment convincingly — and
 * its category has to be one FASHN can do. Anything outside
 * TRYON_CATEGORY_MAP is excluded structurally, which is how underwear
 * and swimwear can never be tried on.
 *
 * Lives in shared because three places ask: the Cloud Function that
 * refuses a generation, the app that decides whether to offer one, and
 * the trigger that stamps the answer onto a post's tags. Three copies
 * of this rule would be three chances to disagree about what a student
 * is allowed to see.
 */
export function isTryOnReady(
  listing: Pick<Listing, 'category'> & { flatPhoto?: ImageRef | null },
): boolean {
  return Boolean(listing.flatPhoto) && listing.category in TRYON_CATEGORY_MAP;
}
