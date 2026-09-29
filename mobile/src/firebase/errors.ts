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

/**
 * The message for a direct Firestore or Storage write that failed.
 *
 * A saved listing that came back refused used to say "check your
 * connection", which was both wrong and actively unhelpful: the server
 * had rejected the write, and blaming her wifi sent her retrying
 * something that could never succeed. These three cases need genuinely
 * different words, because the thing she should do next is different
 * in each.
 */
export function saveErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  const message = error instanceof Error ? error.message : '';
  const text = `${code} ${message}`.toLowerCase();

  if (text.includes('permission-denied') || text.includes('insufficient permissions')) {
    // Her doing it again will not help. Say so, and give us something
    // to search for when she sends a screenshot.
    return "Loane wouldn't accept that. It's our fault, not yours — send us a screenshot at team@joinloane.com and we'll sort it. (save-rejected)";
  }
  if (text.includes('unauthenticated')) {
    return 'You have been signed out. Sign in again and your draft will still be here.';
  }
  if (text.includes('unavailable') || text.includes('network') || text.includes('deadline')) {
    return 'Could not reach Loane. Check your connection and try again.';
  }
  return 'Could not save that. Try again, and tell us if it keeps happening.';
}
