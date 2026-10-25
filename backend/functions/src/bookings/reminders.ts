import {
  addDays,
  formatShortDate,
  type Booking,
  type IsoDate,
  type NotificationType,
} from '@loane/shared';
import { pieceName } from './transitions';

/**
 * Which rental reminders are due for one booking, worked out without
 * touching the database so it can be tested on its own.
 *
 * `today` is the CAMPUS date (see `campusClock`), not the server's. The
 * server runs on UTC, which turns into tomorrow at 8 PM in Columbia —
 * so "Drop off today" used to land at 8 PM the evening before.
 */

export type ReminderKey =
  'startsTomorrow' | 'dropoffToday' | 'dueTomorrow' | 'dueToday' | 'overdue';

export interface Reminder {
  key: ReminderKey;
  uid: string;
  type: NotificationType;
  title: string;
  body: string;
}

type RemindableBooking = Booking & { remindersSent?: Partial<Record<string, boolean>> };

/**
 * No reminder pings her phone in the middle of the night. The clock runs
 * hourly, so anything held back at night goes out at 8 AM instead —
 * and every reminder below still makes sense at 8 AM.
 */
export const REMINDER_HOURS = { from: 8, until: 21 } as const;

export function isReminderHour(hour: number): boolean {
  return hour >= REMINDER_HOURS.from && hour < REMINDER_HOURS.until;
}

export function remindersDue(booking: RemindableBooking, today: IsoDate): Reminder[] {
  // A sale has no dates and nothing comes back, so none of these apply.
  if (booking.kind !== 'rental') return [];

  const sent = booking.remindersSent ?? {};
  const tomorrow = addDays(today, 1);
  const piece = pieceName(booking);
  const due: Reminder[] = [];
  const upcoming = 'rental_upcoming' as const;
  const returning = 'return_reminder' as const;

  if (booking.status === 'confirmed' && booking.startDate === tomorrow && !sent.startsTomorrow) {
    due.push({
      key: 'startsTomorrow',
      uid: booking.renterUid,
      type: upcoming,
      title: 'Your rental starts tomorrow',
      body: `${piece} from ${booking.lender.username}. Sort out the handoff.`,
    });
    due.push({
      key: 'startsTomorrow',
      uid: booking.lenderUid,
      type: upcoming,
      title: 'You are lending tomorrow',
      body: `${piece} goes to ${booking.renter.username}.`,
    });
  }

  /*
    THE LENDER'S SIDE OF THE HANDOFF.

    "Starts tomorrow" told her it was coming. This one lands on the
    morning it has to happen, which is the reminder somebody actually
    acts on — a rental that falls over usually falls over because one
    of them forgot the day of.
  */
  if (booking.status === 'confirmed' && booking.startDate === today && !sent.dropoffToday) {
    due.push({
      key: 'dropoffToday',
      uid: booking.lenderUid,
      type: upcoming,
      title: 'Drop off today',
      body: `${piece} goes to ${booking.renter.displayName} today.`,
    });
    due.push({
      key: 'dropoffToday',
      uid: booking.renterUid,
      type: upcoming,
      title: 'Pick up today',
      body: `${piece} from ${booking.lender.displayName} is yours today.`,
    });
  }

  // A day's warning beats finding out on the morning.
  if (booking.status === 'with_renter' && booking.endDate === tomorrow && !sent.dueTomorrow) {
    due.push({
      key: 'dueTomorrow',
      uid: booking.renterUid,
      type: returning,
      title: 'Due back tomorrow',
      body: `Return ${piece} to ${booking.lender.displayName} tomorrow.`,
    });
  }

  if (booking.status === 'with_renter' && booking.endDate === today && !sent.dueToday) {
    due.push({
      key: 'dueToday',
      uid: booking.renterUid,
      type: returning,
      title: 'Due back today',
      body: `Time to return ${piece} to ${booking.lender.username}.`,
    });
  }

  if (
    booking.status === 'with_renter' &&
    booking.endDate &&
    booking.endDate < today &&
    !sent.overdue
  ) {
    due.push({
      key: 'overdue',
      uid: booking.renterUid,
      type: returning,
      title: 'This is overdue',
      body: `${piece} was due back on ${formatShortDate(booking.endDate)}.`,
    });
    due.push({
      key: 'overdue',
      uid: booking.lenderUid,
      type: returning,
      title: 'A rental is overdue',
      body: `${booking.renter.username} still has ${piece}.`,
    });
  }

  return due;
}
