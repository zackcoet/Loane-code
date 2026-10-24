import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
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
import { rateLimit } from '../lib/rateLimit';

interface SupportInput {
  topic: SupportTopic;
  message: string;
}

export const submitSupportRequest = onCall<SupportInput, Promise<{ requestId: string }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<SupportInput>): Promise<{ requestId: string }> => {
    const user = await requireActiveUser(request);
    const { topic, message = '' } = request.data ?? {};

    if (!(SUPPORT_TOPICS as readonly string[]).includes(topic)) {
      throw invalidArgument('Pick a topic.');
    }
    // A number or a list from a script would crash on .trim() and come
    // back as a vague "something went wrong".
    if (typeof message !== 'string') {
      throw invalidArgument('Tell us what you need help with.');
    }
    const trimmed = message.trim();
    if (trimmed.length < LIMITS.supportMessage.min) {
      throw invalidArgument('Tell us what you need help with.');
    }
    if (trimmed.length > LIMITS.supportMessage.max) {
      throw invalidArgument('That message is too long.');
    }

    // Counted only once the message is good, so a typo-and-retry
    // never uses one up.
    await rateLimit(user.uid, 'support');

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
