import {
  CATEGORIES,
  LIMITS,
  OCCASIONS,
  RENTAL_DURATIONS,
  RESERVED_USERNAMES,
  SIZES,
  type Category,
  type Occasion,
  type RentalDuration,
  type Size,
} from './constants';
import { daysBetween, isIsoDate } from './dates';
import type { Cents, DateRange } from './types/common';

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
