import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type SupportRequest } from '@loane/shared';
import { db, now } from '../lib/admin';
import { failed, notFound } from '../lib/errors';
import { logAdminAction, requireAdminContext, requireReason } from './audit';

interface ResolveSupportInput {
  requestId: string;
  notes: string;
}

export const resolveSupportRequest = onCall<ResolveSupportInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<ResolveSupportInput>): Promise<{ ok: true }> => {
    const admin = requireAdminContext(request);
    const { requestId } = request.data ?? {};
    const notes = requireReason(request.data?.notes, 'Add a note about how this was resolved.');
    if (!requestId) throw notFound('We could not find that support request.');

    const ref = db().collection(COLLECTIONS.supportRequests).doc(requestId);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw notFound('We could not find that support request.');
      const before = snap.data() as SupportRequest;
      if (before.status === 'resolved') throw failed('That support request is already resolved.');

      const patch = {
        status: 'resolved' as const,
        resolvedAt: now(),
        resolvedByUid: admin.uid,
        updatedAt: now(),
      };
      tx.update(ref, patch);
      logAdminAction(tx, {
        admin,
        action: 'resolve_support_request',
        targetType: 'supportRequest',
        targetId: requestId,
        notes,
        before: { status: before.status },
        after: { status: 'resolved' },
      });
    });

    logger.info('Support request resolved', { requestId, by: admin.uid });
    return { ok: true };
  },
);
