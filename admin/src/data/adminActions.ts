/**
 * Calling the admin Cloud Functions.
 *
 * The dashboard never writes to Firestore directly. Every change goes
 * through a function that checks the admin claim server-side and writes
 * an audit row in the same commit — so there is no way to change
 * something here without it being recorded.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

const functions = getFunctions(app);

function call<Input, Output>(name: string) {
  return httpsCallable<Input, Output>(functions, name);
}

export const suspendUser = call<{ uid: string; reason: string; until?: string }, { ok: true }>(
  'suspendUser',
);
export const unsuspendUser = call<{ uid: string; reason: string }, { ok: true }>('unsuspendUser');
export const addAdminNote = call<{ uid: string; note: string }, { noteId: string }>(
  'addAdminNote',
);

export const hideListing = call<{ id: string; reason: string }, { ok: true }>('hideListing');
export const restoreListing = call<{ id: string; reason: string }, { ok: true }>('restoreListing');
export const hidePost = call<{ id: string; reason: string }, { ok: true }>('hidePost');
export const restorePost = call<{ id: string; reason: string }, { ok: true }>('restorePost');
export const hideReview = call<{ id: string; reason: string }, { ok: true }>('hideReview');

export const resolveReport = call<
  {
    reportId: string;
    status: 'reviewing' | 'actioned' | 'dismissed';
    action?: 'none' | 'content_removed' | 'user_warned' | 'user_suspended' | 'user_removed';
    notes: string;
  },
  { ok: true }
>('resolveReport');

export const resolveDispute = call<
  { bookingId: string; outcome: string; notes: string },
  { ok: true }
>('resolveDispute');

/** Turns a callable error into something worth showing an admin. */
export function adminErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : '';
  const cleaned = raw.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
  if (!cleaned || /^internal$/i.test(cleaned)) return fallback;
  return cleaned;
}
