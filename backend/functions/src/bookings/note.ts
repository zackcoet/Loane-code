import { LIMITS } from '@loane/shared';
import { invalidArgument } from '../lib/errors';

/**
 * Free text the other side of a rental will see — a request message, a
 * decline or cancel reason, a drop-off note, a problem note.
 *
 * The app sends short text; this is the backstop for anything that is
 * not the app. Before, a request message was not checked at all: a
 * number instead of text crashed the request with "Something went
 * wrong", and there was no length limit on what landed in the lender's
 * rental page.
 */
export function checkNote(text: unknown): string {
  if (text == null) return '';
  if (typeof text !== 'string') throw invalidArgument('That note is not text.');
  if (text.trim().length > LIMITS.bookingNote.max) {
    throw invalidArgument(`Keep it under ${LIMITS.bookingNote.max} characters.`);
  }
  return text;
}
