import { addDays, datesInRange, type IsoDate } from '@loane/shared';

/**
 * Works out what a lender's blocked-dates list should become.
 *
 * Kept apart from the callable so it can be tested without a database.
 *
 * - Days in the past are dropped. The phone sends back everything she
 *   ever blocked, so without this old days she can no longer see would
 *   slowly fill the yearly limit. "Past" is before yesterday in UTC, so
 *   a lender late in the evening in South Carolina never loses today.
 * - A day already booked by a confirmed rental is refused — unless it
 *   was ALREADY blocked. That happens when she accepts a request made
 *   before she blocked the day. The phone will not let her unblock a
 *   booked day, so refusing it would leave her unable to save her
 *   calendar ever again. The booking already covers the day, so it is
 *   simply dropped from the blocked list.
 */
export function planBlockedDates(input: {
  requested: IsoDate[];
  existing: IsoDate[];
  booked: { startDate?: IsoDate | null; endDate?: IsoDate | null }[];
  today: IsoDate;
}): { ok: true; blocked: IsoDate[] } | { ok: false; clash: IsoDate } {
  const cutoff = addDays(input.today, -1);
  const taken = new Set<IsoDate>();
  for (const b of input.booked) {
    if (!b.startDate || !b.endDate || b.endDate <= b.startDate) continue;
    for (const d of datesInRange({ startDate: b.startDate, endDate: b.endDate })) taken.add(d);
  }
  const existing = new Set(input.existing);

  const kept: IsoDate[] = [];
  for (const d of new Set(input.requested)) {
    if (d < cutoff) continue;
    if (taken.has(d)) {
      if (existing.has(d)) continue;
      return { ok: false, clash: d };
    }
    kept.push(d);
  }
  return { ok: true, blocked: kept.sort() };
}
