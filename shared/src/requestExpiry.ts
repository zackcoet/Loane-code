import { REQUEST_EXPIRY_HOURS, SAME_DAY_RESPONSE_HOURS } from './constants';
import { campusDayStartMs } from './dates';

/**
 * When an unanswered rental request goes stale.
 *
 * REQUEST_EXPIRY_HOURS from now (SAME_DAY_RESPONSE_HOURS for same day),
 * but never past the moment the rental day begins on campus — a request
 * for this Saturday should not sit unanswered into Saturday.
 *
 * And never sooner than SAME_DAY_RESPONSE_HOURS from now. The old rule
 * ("midnight world time, the day before it starts") was already in the
 * past for any request for today or tomorrow, so the next hourly sweep
 * expired it before the lender could see it — and tomorrow is the most
 * common ask there is (gameday is tomorrow). A late-night request for
 * the next day still gets the same short window as a same-day one.
 */
export function requestExpiry(startDate: string, sameDay: boolean, nowMs: number): Date {
  const hours = sameDay ? SAME_DAY_RESPONSE_HOURS : REQUEST_EXPIRY_HOURS;
  const deadline = nowMs + hours * 3_600_000;
  const rentalDayBegins = campusDayStartMs(startDate);
  const soonest = nowMs + SAME_DAY_RESPONSE_HOURS * 3_600_000;
  return new Date(Math.max(soonest, Math.min(deadline, rentalDayBegins)));
}

/** "2 hours", "1 hour", "24 hours" — rounded, never below one hour. */
export function hoursToAnswer(msLeft: number): string {
  const hours = Math.max(1, Math.round(msLeft / 3_600_000));
  return hours === 1 ? '1 hour' : `${hours} hours`;
}
