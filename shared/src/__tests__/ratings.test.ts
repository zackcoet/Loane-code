import { describe, expect, it } from 'vitest';
import { ratingFromVisible } from '../ratings';
import { messagePreview, previewShowsMessage, REMOVED_MESSAGE_TEXT } from '../shares';

const reviews = [
  { id: 'a', rating: 5, isHidden: false },
  { id: 'b', rating: 1, isHidden: false },
  { id: 'c', rating: 4, isHidden: true },
];

describe('ratingFromVisible', () => {
  it('hiding a one-star takes it out of the average', () => {
    expect(ratingFromVisible(reviews, { id: 'b', hide: true })).toEqual({
      ratingCount: 1,
      ratingAverage: 5,
    });
  });

  it('putting a hidden review back counts it again', () => {
    expect(ratingFromVisible(reviews, { id: 'c', hide: false })).toEqual({
      ratingCount: 3,
      ratingAverage: 3.33,
    });
  });

  it('hiding the last visible review leaves no rating, not zero stars', () => {
    expect(
      ratingFromVisible([{ id: 'a', rating: 2, isHidden: false }], { id: 'a', hide: true }),
    ).toEqual({ ratingCount: 0, ratingAverage: null });
  });

  it('hiding one that is already hidden changes nothing', () => {
    expect(ratingFromVisible(reviews, { id: 'c', hide: true })).toEqual({
      ratingCount: 2,
      ratingAverage: 3,
    });
  });
});

describe('previewShowsMessage', () => {
  const message = {
    senderUid: 'uid-maddie',
    body: 'awful words',
    photo: null,
    sharedPost: null,
    sharedListing: null,
  };

  it('matches the inbox preview of the newest message', () => {
    const preview = { senderUid: 'uid-maddie', body: messagePreview(message) };
    expect(previewShowsMessage(preview, message)).toBe(true);
  });

  it('does not touch the preview once someone has written since', () => {
    expect(previewShowsMessage({ senderUid: 'uid-ella', body: 'ok' }, message)).toBe(false);
    expect(previewShowsMessage({ senderUid: 'uid-maddie', body: 'later' }, message)).toBe(false);
  });

  it('copes with a brand-new thread that has no preview', () => {
    expect(previewShowsMessage(null, message)).toBe(false);
  });

  it('the removed text is never mistaken for a real preview', () => {
    expect(REMOVED_MESSAGE_TEXT).not.toBe(messagePreview(message));
  });
});
