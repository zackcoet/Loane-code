import type { DateRange, IsoDate } from './types/common';

/**
 * Date helpers for the availability calendar.
 *
 * Rental dates are plain calendar dates ("2026-10-04"), never timestamps.
 * A booking runs from `startDate` up to but NOT including `endDate` — the
 * item is free again on the end date. Keeping this rule in one place is what
 * stops off-by-one bugs from double-booking a dress on a gameday weekend.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && toIsoDate(d) === value;
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function fromIsoDate(value: IsoDate): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const d = fromIsoDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

/** Whole days between two dates. `endDate` minus `startDate`. */
export function daysBetween(startDate: IsoDate, endDate: IsoDate): number {
  const ms = fromIsoDate(endDate).getTime() - fromIsoDate(startDate).getTime();
  return Math.round(ms / 86_400_000);
}

/** Every date the renter has the item: start inclusive, end exclusive. */
export function datesInRange(range: DateRange): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = range.startDate; d < range.endDate; d = addDays(d, 1)) {
    out.push(d);
  }
  return out;
}

/**
 * Do two bookings collide?
 *
 * Half-open ranges, so a booking ending the 10th and one starting the 10th
 * do not overlap — she returns it in the morning, the next girl takes it
 * that afternoon.
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startDate < b.endDate && b.startDate < a.endDate;
}

/** Is any blacked-out day inside the requested range? */
export function rangeHitsBlackout(range: DateRange, blackoutDates: IsoDate[]): boolean {
  const requested = new Set(datesInRange(range));
  return blackoutDates.some((d) => requested.has(d));
}

/**
 * Which days a listing cannot be rented.
 *
 * Two sources: the owner's own blocked dates, and the days already taken
 * by a booking that blocks the calendar. The calendar on the request
 * screen and the check inside `requestBooking` both use this, so what she
 * sees greyed out is exactly what the server will refuse.
 */
export function unavailableDates(
  blackoutDates: IsoDate[],
  bookedRanges: DateRange[],
): Set<IsoDate> {
  const out = new Set<IsoDate>(blackoutDates);
  for (const range of bookedRanges) {
    for (const day of datesInRange(range)) out.add(day);
  }
  return out;
}

/**
 * Can a rental of `days` days start on `startDate`?
 *
 * Every day it would cover must be free. A start date that looks free but
 * runs into a booked weekend is not actually bookable, and the calendar
 * greys it out for that reason.
 */
export function canStartOn(
  startDate: IsoDate,
  days: number,
  unavailable: Set<IsoDate>,
): boolean {
  const range = { startDate, endDate: addDays(startDate, days) };
  return datesInRange(range).every((day) => !unavailable.has(day));
}

/** "Fri 3 Oct" — short, unambiguous, no year for dates this season. */
export function formatShortDate(value: IsoDate): string {
  return fromIsoDate(value).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Fri 3 Oct – Mon 6 Oct" */
export function formatRange(range: DateRange): string {
  return `${formatShortDate(range.startDate)} – ${formatShortDate(range.endDate)}`;
}

/**
 * "just now", "2h", "3 days ago" — how long since something happened.
 *
 * Deliberately coarse. Nobody reading a feed cares whether a post is 47
 * or 52 minutes old, and a precise number invites her to keep checking.
 *
 * Accepts anything a Firestore timestamp turns into: a Date, a number of
 * milliseconds, or an object with `toDate()`. Returns an empty string for
 * anything it cannot read, because a missing timestamp should show
 * nothing rather than "NaN days ago".
 */
export function timeAgo(value: unknown, nowMs: number = Date.now()): string {
  const ms = toMillis(value);
  if (ms == null) return '';

  // A clock skew of a few seconds between the phone and the server can
  // put a brand new post in the future. Treat that as "just now".
  const seconds = Math.max(0, Math.round((nowMs - ms) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;

  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const maybe = value as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') {
    const d = maybe.toDate();
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  return null;
}
