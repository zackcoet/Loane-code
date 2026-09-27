/**
 * Turns a callable-function error into something a person can read.
 *
 * Firebase appends the HTTP status to the message, so the raw text comes
 * through as "Enter a name. [400]". We show the sentence and drop the code.
 */

import { FunctionsError } from 'firebase/functions';

export function callableErrorMessage(error: unknown, fallback: string): string {
  const raw =
    error instanceof FunctionsError || error instanceof Error ? error.message : '';

  // Strip a trailing " [400]" / " [already-exists]" style suffix.
  const cleaned = raw.replace(/\s*\[[^\]]+\]\s*$/, '').trim();

  // Firebase sometimes yields "internal" or "INTERNAL" for an unhandled
  // server error, which tells the user nothing.
  if (!cleaned || /^internal$/i.test(cleaned)) return fallback;
  return cleaned;
}
