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

/**
 * The time zone a student's "today" is in.
 *
 * Rental dates are calendar dates, but WHICH calendar day it is right
 * now depends on where you stand. Columbia is on Eastern time; the
 * server's clock is UTC, which flips to tomorrow at 8 PM there. Anything
 * that says "today" to her — a "Drop off today" reminder — must use her
 * day, not the server's. Every campus is Eastern until one isn't; then
 * this becomes a field on the campus.
 */
export const CAMPUS_TIME_ZONE = 'America/New_York';

/** Today's date and the hour (0–23) on campus at the given moment. */
export function campusClock(
  nowMs: number = Date.now(),
  timeZone: string = CAMPUS_TIME_ZONE,
): { today: IsoDate; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(nowMs));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const today = `${get('year')}-${get('month')}-${get('day')}`;
    const hour = Number(get('hour'));
    if (isIsoDate(today) && Number.isInteger(hour) && hour >= 0 && hour <= 23) {
      return { today, hour };
    }
  } catch {
    // Fall through. Some phone JavaScript engines ship a thin Intl.
  }
  /*
    The phone runs this too, and not every phone engine knows time
    zones. Rather than quietly fall back to world time (the very bug
    this exists to fix), work Eastern time out by hand: US daylight
    time runs from 2 AM on the second Sunday of March to 2 AM on the
    first Sunday of November.
  */
  const offsetHours = timeZone === CAMPUS_TIME_ZONE ? easternOffsetHours(nowMs) : 0;
  const local = new Date(nowMs + offsetHours * 3_600_000);
  return { today: toIsoDate(local), hour: local.getUTCHours() };
}

/** Today's date on campus — the "today" every rental date is measured from. */
export function campusToday(nowMs: number = Date.now()): IsoDate {
  return campusClock(nowMs).today;
}

/**
 * The moment a calendar day begins on campus (midnight in Columbia),
 * in milliseconds. Midnight is never skipped or repeated by US clock
 * changes (they happen at 2 AM), so there is always exactly one.
 */
export function campusDayStartMs(date: IsoDate): number {
  const utcMidnight = fromIsoDate(date).getTime();
  for (const hoursBehind of [4, 5]) {
    const ms = utcMidnight + hoursBehind * 3_600_000;
    const clock = campusClock(ms);
    if (clock.today === date && clock.hour === 0) return ms;
  }
  // Not an Eastern campus: fall back to world-time midnight.
  return utcMidnight;
}

/** −4 in US daylight time, −5 otherwise. Only used when Intl can't say. */
function easternOffsetHours(nowMs: number): number {
  const year = new Date(nowMs).getUTCFullYear();
  // nth Sunday of a month, as a UTC day-of-month.
  const nthSunday = (month: number, n: number) => {
    const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
    return 1 + ((7 - firstDay) % 7) + 7 * (n - 1);
  };
  // 2 AM Eastern standard = 07:00 UTC; 2 AM Eastern daylight = 06:00 UTC.
  const dstStart = Date.UTC(year, 2, nthSunday(2, 2), 7);
  const dstEnd = Date.UTC(year, 10, nthSunday(10, 1), 6);
  return nowMs >= dstStart && nowMs < dstEnd ? -4 : -5;
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
export function canStartOn(startDate: IsoDate, days: number, unavailable: Set<IsoDate>): boolean {
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
 * "just now", "25 minutes ago", "3 days ago" — how long since
 * something happened.
 *
 * SPELLED OUT, not "25m". Minutes and hours were the only two rungs
 * that abbreviated, so the same list could read "25m" above "3 days
 * ago" — which looks like two different features wrote it. Loane is
 * not a trading screen; there is no reason to save four characters.
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
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;

  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/**
 * Milliseconds since the epoch from anything a Firestore timestamp turns
 * into, or null when it cannot be read (including a server timestamp
 * that has not come back yet).
 */
export function toMillis(value: unknown): number | null {
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
