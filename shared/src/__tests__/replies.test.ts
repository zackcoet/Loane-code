import { describe, expect, it } from 'vitest';
import { replyFor, replyPreview } from '../replies';
import type { Message } from '../types';

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderUid: 'uid-maddie',
    body: 'Is it true to size?',
    photo: null,
    sharedPost: null,
    readBy: ['uid-maddie'],
    isDeleted: false,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  } as Message;
}

describe('replyFor', () => {
  it('copies the original word for word, because the rules check that', () => {
    expect(replyFor(message())).toEqual({
      messageId: 'm1',
      senderUid: 'uid-maddie',
      body: 'Is it true to size?',
      hasPhoto: false,
      hasSharedPost: false,
      hasSharedListing: false,
    });
  });

  it('notes a photo or a shared look', () => {
    const r = replyFor(
      message({
        body: '',
        photo: { url: 'https://x', path: 'p', width: 1, height: 1 },
      }),
    );
    expect(r.hasPhoto).toBe(true);
    expect(r.hasSharedPost).toBe(false);
  });
});

describe('replyPreview', () => {
  it('shows her words when there are any', () => {
    expect(replyPreview(replyFor(message()))).toBe('Is it true to size?');
  });

  it('says what was sent when there were no words', () => {
    const base = replyFor(message({ body: '  ' }));
    expect(replyPreview({ ...base, hasPhoto: true })).toBe('Photo');
    expect(replyPreview({ ...base, hasSharedPost: true })).toBe('A look');
    expect(replyPreview({ ...base, hasSharedListing: true })).toBe('A piece');
    expect(replyPreview(base)).toBe('Message');
  });

  it('copes with a reply written before pieces could be shared', () => {
    const { hasSharedListing: _dropped, ...old } = replyFor(message({ body: '' }));
    expect(replyPreview(old)).toBe('Message');
  });
});
