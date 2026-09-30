import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  LIMITS,
  SUPPORT_TOPICS,
  type SupportRequest,
  type SupportTopic,
} from '@loane/shared';
import { db, now } from '../lib/admin';
import { invalidArgument } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';

interface SupportInput {
  topic: SupportTopic;
  message: string;
}

export const submitSupportRequest = onCall<SupportInput, Promise<{ requestId: string }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<SupportInput>): Promise<{ requestId: string }> => {
    const user = await requireActiveUser(request);
    const { topic, message = '' } = request.data ?? {};
    const trimmed = message.trim();

    if (!(SUPPORT_TOPICS as readonly string[]).includes(topic)) {
      throw invalidArgument('Pick a topic.');
    }
    if (trimmed.length < LIMITS.supportMessage.min) {
      throw invalidArgument('Tell us what you need help with.');
    }
    if (trimmed.length > LIMITS.supportMessage.max) {
      throw invalidArgument('That message is too long.');
    }

    const ref = db().collection(COLLECTIONS.supportRequests).doc();
    const row: Omit<SupportRequest, 'createdAt' | 'updatedAt'> = {
      id: ref.id,
      campusId: user.campusId,
      requesterUid: user.uid,
      requester: {
        uid: user.uid,
        username: user.username,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        campusId: user.campusId,
        isVerified: user.isVerified,
      },
      topic,
      message: trimmed,
      status: 'open',
      resolvedAt: null,
      resolvedByUid: null,
    };

    await ref.set({ ...row, createdAt: now(), updatedAt: now() });
    logger.info('Support request submitted', { requestId: ref.id, topic });
    return { requestId: ref.id };
  },
);
