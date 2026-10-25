/**
 * Her closet's calendar: what is out, when, and what she has to do
 * about it today.
 *
 * ONE READ, NOT ONE PER PIECE. Her lending bookings already carry the
 * listing name, the dates and the other student, so a month of
 * activity is a single query she is already making elsewhere. Reading
 * each listing's calendar separately would be a query per garment for
 * a screen she opens to glance at.
 *
 * Only bookings that actually hold a date count — a `requested` one
 * does not, because nobody has promised anything yet, and showing it
 * as "out" would have her turn down a rental for a day that is free.
 */

import { useMemo } from 'react';
import { BLOCKING_BOOKING_STATUSES, addDays, campusToday, type Booking, type IsoDate } from '@loane/shared';
import { useMyBookings } from './useBookings';

export interface DayActivity {
  date: IsoDate;
  /** Pieces out on this day, including the day it leaves. */
  out: Booking[];
  /** To hand over today. */
  dropoffs: Booking[];
  /** Coming back today. */
  returns: Booking[];
}

/** One piece's run of booked days, for the week view. */
export interface PieceRun {
  listingId: string;
  name: string;
  coverUrl: string | null;
  /** Dates within the window on which this piece is out. */
  busy: Set<IsoDate>;
}

export function useClosetCalendar() {
  const { bookings, loading } = useMyBookings('lending');

  /** Only the ones that genuinely hold dates. */
  const held = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (BLOCKING_BOOKING_STATUSES as readonly string[]).includes(b.status) &&
          b.startDate &&
          b.endDate,
      ),
    [bookings],
  );

  /**
   * Date → what is happening. Built once for everything on the screen,
   * so the month shading, the day sheet and the week rows cannot
   * disagree about what is out.
   */
  const byDate = useMemo(() => {
    const map = new Map<IsoDate, DayActivity>();
    const touch = (date: IsoDate) => {
      if (!map.has(date)) map.set(date, { date, out: [], dropoffs: [], returns: [] });
      return map.get(date)!;
    };

    for (const b of held) {
      // Half-open: startDate is hers, endDate is the day it comes back
      // and the piece is free again. See shared/src/dates.ts.
      for (let d = b.startDate!; d < b.endDate!; d = addDays(d, 1)) {
        touch(d).out.push(b);
      }
      touch(b.startDate!).dropoffs.push(b);
      touch(b.endDate!).returns.push(b);
    }
    return map;
  }, [held]);

  /** The busiest day in view, so shading is relative to her own closet. */
  const busiest = useMemo(
    () => Math.max(1, ...[...byDate.values()].map((d) => d.out.length)),
    [byDate],
  );

  const runs = useMemo(() => {
    const map = new Map<string, PieceRun>();
    for (const b of held) {
      const run =
        map.get(b.listingId) ??
        map
          .set(b.listingId, {
            listingId: b.listingId,
            name: b.listing.name,
            coverUrl: b.listing.coverUrl,
            busy: new Set<IsoDate>(),
          })
          .get(b.listingId)!;
      for (let d = b.startDate!; d < b.endDate!; d = addDays(d, 1)) run.busy.add(d);
    }
    return [...map.values()];
  }, [held]);

  const today = campusToday();

  return {
    loading,
    byDate,
    busiest,
    runs,
    today,
    /** What she has to do today, which is the reason to open this. */
    todayActivity: byDate.get(today) ?? { date: today, out: [], dropoffs: [], returns: [] },
  };
}
