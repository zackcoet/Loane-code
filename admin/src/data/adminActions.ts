/**
 * Calling the admin Cloud Functions.
 *
 * The dashboard never writes to Firestore directly. Every change goes
 * through a function that checks the admin claim server-side and writes
 * an audit row in the same commit — so there is no way to change
 * something here without it being recorded.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import type { FeatureFlagKey, LegalDocKind } from '@loane/shared';
import { app } from '../firebase/config';

const functions = getFunctions(app);

function call<Input, Output>(name: string) {
  return httpsCallable<Input, Output>(functions, name);
}

export const suspendUser = call<{ uid: string; reason: string; until?: string }, { ok: true }>(
  'suspendUser',
);
export const unsuspendUser = call<{ uid: string; reason: string }, { ok: true }>('unsuspendUser');
export const addAdminNote = call<{ uid: string; note: string }, { noteId: string }>('addAdminNote');

export const hideListing = call<{ id: string; reason: string }, { ok: true }>('hideListing');
export const restoreListing = call<{ id: string; reason: string }, { ok: true }>('restoreListing');
export const hidePost = call<{ id: string; reason: string }, { ok: true }>('hidePost');
export const restorePost = call<{ id: string; reason: string }, { ok: true }>('restorePost');
export const restoreReview = call<{ id: string; reason: string }, { ok: true }>('restoreReview');
export const hideComment = call<{ id: string; reason: string }, { ok: true }>('hideComment');
export const restoreComment = call<{ id: string; reason: string }, { ok: true }>('restoreComment');
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

export const resolveSupportRequest = call<{ requestId: string; notes: string }, { ok: true }>(
  'resolveSupportRequest',
);

export const saveLegalDraft = call<
  { kind: LegalDocKind; text: string; effectiveDate: string; significantChange: boolean },
  { ok: true; nextVersion: number }
>('saveLegalDraft');

export const publishLegalDoc = call<
  { kind: LegalDocKind; text: string; effectiveDate: string; significantChange: boolean },
  { id: string; version: number }
>('publishLegalDoc');

/** Turns a callable error into something worth showing an admin. */
// --- AI try-on -------------------------------------------------------------

/**
 * Extra free try-ons for one student.
 *
 * The allowance is five for life, which Ella and our testers will burn
 * through in an afternoon of judging the thing. Without this the people
 * whose opinion we need are the first ones locked out.
 */
export const grantTryOns = call<{ uid: string; count: number; reason: string }, { total: number }>(
  'grantTryOns',
);

/** One switch on the switchboard (`config/features`). Audited server-side. */
export const setFeatureFlag = call<
  { flag: FeatureFlagKey; value: boolean; reason: string },
  { ok: true }
>('setFeatureFlag');

export function adminErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : '';
  const cleaned = raw.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
  if (!cleaned || /^internal$/i.test(cleaned)) return fallback;
  return cleaned;
}
