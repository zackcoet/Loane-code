import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { COLLECTIONS, LIMITS, profileShareSnapshot, type User } from '@loane/shared';
import { db } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { isBlockedEitherWay } from '../moderation/block';
import { rateLimit } from '../lib/rateLimit';
import { cleanNote, cleanRecipients, sendToEach } from './sendToEach';

/**
 * `shareProfile`
 *
 * Sending someone's profile — her closet — to friends: "you have to see
 * her closet". The look and piece versions are `sharePost` and
 * `shareListing`; this is the same thing for a whole person.
 *
 * A function rather than a normal message write because the card shows
 * a name and a photo, and those have to be really hers. Otherwise a
 * phone could send a card that says @ella but opens somebody else.
 *
 * Her own profile is allowed — that is how a girl tells her friends to
 * come rent from her. The person being shared is NOT notified, the
 * same as Instagram.
 */

interface ShareInput {
  uid: string;
  toUids: string[];
  /** An optional line of her own, sent with it. */
  note?: string;
}

interface ShareResult {
  /** How many threads it actually landed in. */
  sentTo: number;
  /** The thread to open when she sent it to exactly one person. */
  conversationId: string | null;
}

export const shareProfile = onCall<ShareInput, Promise<ShareResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<ShareInput>): Promise<ShareResult> => {
    const me = await requireVerifiedStudent(request);
    const uid = request.data?.uid;
    const note = cleanNote(request.data?.note);
    const toUids = cleanRecipients(request.data?.toUids, me.uid);

    if (!uid || typeof uid !== 'string') throw invalidArgument('Whose profile?');
    if (toUids.length === 0) throw invalidArgument('Pick someone to send it to.');
    if (toUids.length > LIMITS.sharePostRecipients.max) {
      throw invalidArgument(`You can send to ${LIMITS.sharePostRecipients.max} people at a time.`);
    }
    if (note.length > LIMITS.messageBody.max) throw invalidArgument('That note is too long.');
    await rateLimit(me.uid, 'share');

    const snap = await db().collection(COLLECTIONS.users).doc(uid).get();
    if (!snap.exists) throw notFound('That account is gone.');
    const user = { ...(snap.data() as User), uid: snap.id };
    // Suspended or deleted: neither should land in a chat as a closet
    // worth visiting. Blocked either way: the same "not found" as a
    // missing account, so a block is never revealed by a share.
    if (user.status !== 'active') throw notFound('That account is not available.');
    if (uid !== me.uid && (await isBlockedEitherWay(me.uid, uid))) {
      throw notFound('That account is not available.');
    }

    const { sentTo, lastConversationId } = await sendToEach(
      me,
      toUids,
      {
        body: note,
        sharedPost: null,
        sharedListing: null,
        sharedProfile: profileShareSnapshot(user),
      },
      uid,
    );

    if (sentTo === 0) throw failed('We could not send that to anyone you picked.');

    logger.info('Profile shared', { uid, sentTo });
    return { sentTo, conversationId: sentTo === 1 ? lastConversationId : null };
  },
);
