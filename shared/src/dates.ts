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
