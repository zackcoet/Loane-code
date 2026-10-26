/**
 * The pure parts of the background jobs that keep tag labels, booked
 * dates and inbox previews up to date. Needs no emulator.
 */
import { describe, expect, it } from 'vitest';
import type { Listing, Post } from '@loane/shared';
import { labelOf, relabelPost } from '../triggers/refreshTagLabels';
import { bookedDatesOf } from '../triggers/syncListingAvailability';
import { eventMillis } from '../lib/eventTime';

const listing = (over: Partial<Listing> = {}) =>
  ({
    id: 'l1',
    name: 'Red mini',
    coverUrl: 'https://example.com/red.jpg',
    pricing: { oneDayCents: 1500, threeDayCents: 2500, sevenDayCents: 4000 },
    salePriceCents: null,
    owner: { username: 'ella' },
    ...over,
  }) as unknown as Listing;

const tag = (listingId: string, name = 'old') => ({
  listingId,
  x: 0.5,
  y: 0.5,
  ownerUid: 'u',
  label: { name, coverUrl: null, priceCents3Day: 1, salePriceCents: null, ownerUsername: 'x' },
});

const post = (over: Record<string, unknown> = {}) =>
  ({
    taggedListingIds: ['l1', 'l2'],
    photos: [
      { url: 'a', tags: [tag('l1'), tag('l2', 'other')] },
      { url: 'b', tags: [] },
    ],
    taggedListings: [
      { listingId: 'l1', name: 'old', coverUrl: null, priceCents3Day: 1, salePriceCents: null },
      { listingId: 'l2', name: 'other', coverUrl: null, priceCents3Day: 9, salePriceCents: null },
    ],
    ...over,
  }) as unknown as Post;

describe('labelOf', () => {
  it('copies the name, photo, prices and owner', () => {
    expect(labelOf(listing())).toMatchObject({
      name: 'Red mini',
      coverUrl: 'https://example.com/red.jpg',
      priceCents3Day: 2500,
      salePriceCents: null,
      ownerUsername: 'ella',
    });
  });

  it('copes with a piece that has no rental prices at all', () => {
    const label = labelOf(listing({ pricing: undefined as never, salePriceCents: 9000 }));
    expect(label.priceCents3Day).toBeNull();
    expect(label.salePriceCents).toBe(9000);
  });
});

describe('relabelPost', () => {
  const label = labelOf(listing({ name: 'New name' }));

  it('changes only this piece’s tags and summary', () => {
    const patch = relabelPost(post(), 'l1', label)!;
    expect(patch.photos[0]!.tags[0]!.label.name).toBe('New name');
    expect(patch.photos[0]!.tags[1]!.label.name).toBe('other');
    expect(patch.photos[1]!.tags).toEqual([]);
    expect(patch.taggedListings[0]!.name).toBe('New name');
    expect(patch.taggedListings[0]!.priceCents3Day).toBe(2500);
    expect(patch.taggedListings[1]!.name).toBe('other');
  });

  it('keeps where the tag sits on the photo', () => {
    const patch = relabelPost(post(), 'l1', label)!;
    expect(patch.photos[0]!.tags[0]).toMatchObject({ listingId: 'l1', x: 0.5, y: 0.5 });
  });

  it('leaves a look alone once she has untagged the piece', () => {
    expect(relabelPost(post({ taggedListingIds: ['l2'] }), 'l1', label)).toBeNull();
  });

  it('copes with a look missing its photo list', () => {
    const patch = relabelPost(post({ photos: undefined, taggedListings: undefined }), 'l1', label)!;
    expect(patch).toEqual({ photos: [], taggedListings: [] });
  });
});

describe('bookedDatesOf', () => {
  it('lists every night held, end date not included', () => {
    expect(bookedDatesOf([{ startDate: '2026-10-30', endDate: '2026-11-02' }])).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('merges overlapping rentals without repeats, in order', () => {
    expect(
      bookedDatesOf([
        { startDate: '2026-11-03', endDate: '2026-11-05' },
        { startDate: '2026-11-01', endDate: '2026-11-04' },
      ]),
    ).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
  });

  it('ignores a sale, which has no dates', () => {
    expect(bookedDatesOf([{ startDate: null, endDate: null } as never])).toEqual([]);
  });
});

describe('eventMillis', () => {
  it('reads the event’s own time', () => {
    expect(eventMillis('2026-10-26T04:00:00.000Z')).toBe(Date.parse('2026-10-26T04:00:00.000Z'));
  });

  it('falls back to now when the time is missing or junk', () => {
    const before = Date.now();
    expect(eventMillis(undefined)).toBeGreaterThanOrEqual(before);
    expect(eventMillis('not a date')).toBeGreaterThanOrEqual(before);
  });
});
