/**
 * Replying to one message in a chat.
 *
 * Lives here rather than in the app because the security rules hold the
 * app to exactly this shape — the copy of the original must match the
 * real message word for word — and the two must not drift apart.
 */

import type { Message, MessageReply } from './types';

/** The quote to attach when she replies to `original`. */
export function replyFor(original: Message): MessageReply {
  return {
    messageId: original.id,
    senderUid: original.senderUid,
    body: original.body,
    hasPhoto: original.photo != null,
    hasSharedPost: original.sharedPost != null,
    hasSharedListing: original.sharedListing != null,
    // Only when true: the live database rules before profile sharing
    // refuse a quote carrying this field, and an app update can reach
    // phones before the rules are deployed. Absent reads as "no".
    ...(original.sharedProfile != null ? { hasSharedProfile: true } : {}),
  };
}

/** One line of text for the quote: her words, or what she sent. */
export function replyPreview(reply: MessageReply): string {
  const words = reply.body.trim();
  if (words) return words;
  if (reply.hasSharedProfile) return 'A profile';
  if (reply.hasSharedListing) return 'A piece';
  if (reply.hasSharedPost) return 'A look';
  if (reply.hasPhoto) return 'Photo';
  return 'Message';
}
