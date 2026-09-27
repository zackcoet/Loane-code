import type { CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTIONS, type AdminAction } from '@loane/shared';
import { db, now } from '../lib/admin';
import { invalidArgument, permissionDenied } from '../lib/errors';
import type { WriteBatch, Transaction } from 'firebase-admin/firestore';

/**
 * Every admin action goes through here.
 *
 * THE POINT: the change and the audit row are written in the SAME batch.
 * Not two steps. If the audit row could fail on its own, we would
 * eventually have an action nobody can account for — which is the one
 * thing an audit log exists to prevent.
 *
 * Every row answers: who did it, what they did, to what, why, and what
 * the thing looked like before and after.
 */

export interface AdminContext {
  uid: string;
  email: string | null;
}

/** Confirms the caller really is an admin, server-side. */
export function requireAdminContext(request: CallableRequest): AdminContext {
  if (!request.auth?.uid) throw permissionDenied('Sign in as an admin.');
  if (request.auth.token?.admin !== true) {
    // The dashboard checks this too, but that check is a friendly error
    // message. THIS is the lock.
    throw permissionDenied('Admins only.');
  }
  return { uid: request.auth.uid, email: (request.auth.token.email as string) ?? null };
}

/** Every admin action must say why. A log full of blanks is not a log. */
export function requireReason(reason: string | undefined, prompt: string): string {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) throw invalidArgument(prompt);
  if (trimmed.length > 1000) throw invalidArgument('That note is too long.');
  return trimmed;
}

interface LogParams {
  admin: AdminContext;
  action: string;
  targetType: AdminAction['targetType'];
  targetId: string;
  notes: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Queues the audit row onto a batch or transaction the caller is
 * already using, so it commits or fails with the change itself.
 */
export function logAdminAction(writer: WriteBatch | Transaction, params: LogParams): string {
  const ref = db().collection(COLLECTIONS.adminActions).doc();

  const row: Omit<AdminAction, 'createdAt' | 'updatedAt'> = {
    id: ref.id,
    adminUid: params.admin.uid,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    notes: params.notes,
    before: params.before ?? null,
    after: params.after ?? null,
  };

  // Both WriteBatch and Transaction have set(); their overloads do not
  // unify, so narrow to the one shape we use.
  (writer as { set: (r: unknown, d: unknown) => unknown }).set(ref, {
    ...row,
    adminEmail: params.admin.email,
    createdAt: now(),
    updatedAt: now(),
  });

  return ref.id;
}
