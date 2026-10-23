import { describe, expect, it } from 'vitest';
import {
  LIKED_MESSAGE_PREVIEW,
  likeInboxUpdate,
  listingShareSnapshot,
  messagePreview,
  profileShareSnapshot,
} from '../shares';
import { replyFor, replyPreview } from '../replies';
import type { Listing, Message, User } from '../types';

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'l1',
    owner: { uid: 'uid-ella', username: 'ellapetrick', displayName: 'Ella', photoUrl: null },
    name: 'Black satin slip dress',
    intent: 'rent',
    coverUrl: 'https://img/cover',
    photos: [{ url: 'https://img/first', path: 'p', width: 1, height: 1 }],
    pricing: { oneDayCents: 2500, threeDayCents: 4000, sevenDayCents: null },
    salePriceCents: 9000,
    ...overrides,
  } as Listing;
}

describe('listingShareSnapshot', () => {
  it('keeps what the chat card needs and nothing else', () => {
    expect(listingShareSnapshot(listing())).toEqual({
      listingId: 'l1',
      photoUrl: 'https://img/cover',
      name: 'Black satin slip dress',
      ownerUsername: 'ellapetrick',
      intent: 'rent',
      rentFromCents: 2500,
      // Rent-only, so a stale sale price on the doc must not leak out.
      salePriceCents: null,
    });
  });

  it('takes the cheapest rental price, not the first', () => {
    const s = listingShareSnapshot(
      listing({ pricing: { oneDayCents: null, threeDayCents: 3000, sevenDayCents: 2800 } }),
    );
    expect(s.rentFromCents).toBe(2800);
  });

  it('shows only the sale price for a piece that is only for sale', () => {
    const s = listingShareSnapshot(listing({ intent: 'sell' }));
    expect(s.rentFromCents).toBeNull();
    expect(s.salePriceCents).toBe(9000);
  });

  it('shows both for a piece offered both ways', () => {
    const s = listingShareSnapshot(listing({ intent: 'both' }));
    expect(s.rentFromCents).toBe(2500);
    expect(s.salePriceCents).toBe(9000);
  });

  it('falls back to the first photo, then to nothing', () => {
    expect(listingShareSnapshot(listing({ coverUrl: null })).photoUrl).toBe('https://img/first');
    expect(listingShareSnapshot(listing({ coverUrl: null, photos: [] })).photoUrl).toBeNull();
  });

  it('trims a very long name', () => {
    expect(listingShareSnapshot(listing({ name: 'x'.repeat(500) })).name).toHaveLength(140);
  });
});

function user(overrides: Partial<User> = {}): User {
  return {
    uid: 'uid-ella',
    username: 'ellapetrick',
    displayName: 'Ella Petrick',
    photoUrl: 'https://img/ella',
    email: 'private@email.sc.edu',
    stats: { listingCount: 12 },
    ...overrides,
  } as User;
}

describe('profileShareSnapshot', () => {
  it('keeps what the chat card needs and nothing private', () => {
    expect(profileShareSnapshot(user())).toEqual({
      uid: 'uid-ella',
      username: 'ellapetrick',
      displayName: 'Ella Petrick',
      photoUrl: 'https://img/ella',
      listingCount: 12,
    });
  });

  it('copes with no photo and no counters yet', () => {
    const snap = profileShareSnapshot(user({ photoUrl: null, stats: undefined }));
    expect(snap.photoUrl).toBeNull();
    expect(snap.listingCount).toBe(0);
  });

  it('never shows a negative closet size', () => {
    expect(
      profileShareSnapshot(user({ stats: { listingCount: -2 } } as Partial<User>)).listingCount,
    ).toBe(0);
  });

  it('is what the inbox and a reply call it', () => {
    const sharedProfile = profileShareSnapshot(user());
    expect(
      messagePreview({
        body: '',
        photo: null,
        sharedPost: null,
        sharedListing: null,
        sharedProfile,
      }),
    ).toBe('Sent a profile');
    const quote = replyFor({
      id: 'm1',
      senderUid: 'uid-maddie',
      body: '',
      photo: null,
      sharedPost: null,
      sharedListing: null,
      sharedProfile,
    } as Message);
    expect(quote.hasSharedProfile).toBe(true);
    expect(replyPreview(quote)).toBe('A profile');
  });
});

describe('messagePreview', () => {
  const empty = { body: '', photo: null, sharedPost: null, sharedListing: null };

  it('prefers her words', () => {
    expect(messagePreview({ ...empty, body: 'Saturday?' })).toBe('Saturday?');
  });

  it('says what was sent when there were no words', () => {
    expect(messagePreview({ ...empty, sharedListing: listingShareSnapshot(listing()) })).toBe(
      'Sent a piece',
    );
    expect(
      messagePreview({
        ...empty,
        sharedPost: { postId: 'p', photoUrl: null, caption: '', authorUsername: 'a' },
      }),
    ).toBe('Sent a look');
    expect(messagePreview({ ...empty, photo: { url: 'u', path: 'p', width: 1, height: 1 } })).toBe(
      'Sent a photo',
    );
    expect(messagePreview(empty)).toBe('');
  });

  it('copes with messages from before pieces could be shared', () => {
    const { sharedListing: _old, ...older } = empty;
    expect(messagePreview(older as typeof empty)).toBe('');
  });
});

describe('likeInboxUpdate', () => {
  const ME = 'uid-ella';
  const THEM = 'uid-maddie';
  const last = { body: 'see you at 4', senderUid: ME };

  it('updates the inbox when the other person hearts her message', () => {
    expect(likeInboxUpdate([], [THEM], ME, last)).toEqual({ likerUid: THEM, bumpUnread: true });
  });

  it('ignores hearting your own message', () => {
    expect(likeInboxUpdate([], [ME], ME, last)).toBeNull();
  });

  it('ignores taking a heart back', () => {
    expect(likeInboxUpdate([THEM], [], ME, last)).toBeNull();
  });

  it('counts a run of hearts from the same person once', () => {
    const liked = { body: LIKED_MESSAGE_PREVIEW, senderUid: THEM };
    expect(likeInboxUpdate([], [THEM], ME, liked)).toEqual({ likerUid: THEM, bumpUnread: false });
  });
});
