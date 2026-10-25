/**
 * Checking what the phone sends when she saves a piece. No emulator
 * needed — these are pure checks.
 *
 *   - Each NEW photo must be one she uploaded: her own folder for this
 *     piece, our bucket, and the link must be that exact file.
 *   - A photo already on the piece is kept as it is (older and seeded
 *     pieces stay editable).
 *   - The rules of a good piece are the form's own (validateListingDraft).
 *   - Junk input gets a clear answer instead of a crash.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImageRef } from '@loane/shared';
import { acceptPhoto, parseListingInput } from '../listings/writeListing';

const UID = 'uid-lender';
const LISTING = 'piece-1';
const FOLDER = `users/${UID}/listings/${LISTING}/`;
const PATH = `${FOLDER}0-1.jpg`;
const GOOGLE = 'https://firebasestorage.googleapis.com';

function urlFor(path: string, bucket = 'demo-loane.firebasestorage.app', host = GOOGLE) {
  return `${host}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=abc`;
}

function photo(overrides: Record<string, unknown> = {}) {
  return { path: PATH, url: urlFor(PATH), width: 1200, height: 1600, bytes: 90_000, ...overrides };
}

function piece(overrides: Record<string, unknown> = {}) {
  return {
    listingId: LISTING,
    isNew: true,
    name: 'Vintage Silk Slip Dress',
    description: '',
    brand: null,
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    condition: 'like_new',
    occasions: ['formal'],
    intent: 'rent',
    oneDayCents: 1500,
    threeDayCents: 2500,
    sevenDayCents: 4000,
    salePriceCents: null,
    garmentValueCents: 12000,
    cleaningFeeCents: null,
    photos: [photo()],
    flatPhoto: null,
    sameDay: false,
    availableNow: true,
    ...overrides,
  };
}

function problem(data: unknown): string {
  try {
    parseListingInput(data);
    return 'ok';
  } catch (error) {
    return (error as { message?: string }).message ?? 'error';
  }
}

function photoProblem(value: unknown, already: ImageRef[] = []): string {
  try {
    acceptPhoto(value, UID, LISTING, already);
    return 'ok';
  } catch (error) {
    return (error as { message?: string }).message ?? 'error';
  }
}

const saved = { ...process.env };
beforeEach(() => {
  process.env.GCLOUD_PROJECT = 'demo-loane';
  delete process.env.FUNCTIONS_EMULATOR;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  delete process.env.STORAGE_BUCKET;
});
afterEach(() => {
  process.env = { ...saved };
});

describe('parseListingInput', () => {
  it('accepts a good piece', () => {
    expect(problem(piece())).toBe('ok');
    expect(problem(piece({ intent: 'sell', salePriceCents: 3000 }))).toBe('ok');
  });

  it('uses the form’s own rules, with the form’s own words', () => {
    expect(problem(piece({ photos: [] }))).toMatch(/photo/i);
    expect(problem(piece({ occasions: [] }))).toMatch(/occasion/i);
    expect(problem(piece({ oneDayCents: null }))).toBe('Set a 1-day price.');
    expect(problem(piece({ garmentValueCents: null }))).toMatch(/worth/);
    expect(problem(piece({ intent: 'sell', salePriceCents: null }))).toBe('Set a sale price.');
    expect(problem(piece({ name: 'x' }))).not.toBe('ok');
  });

  it('refuses prices that are not whole cents', () => {
    expect(problem(piece({ threeDayCents: 25.5 }))).toBe('Prices must be whole dollars and cents.');
    expect(problem(piece({ threeDayCents: '2500' }))).toBe(
      'Prices must be whole dollars and cents.',
    );
  });

  it('refuses a category, size, condition or rent-or-sell it does not know', () => {
    expect(problem(piece({ category: 'spaceships' }))).toBe('Pick a category.');
    expect(problem(piece({ size: 'XXXXL' }))).toBe('Pick a valid size.');
    expect(problem(piece({ shoeSize: '99' }))).toBe('Pick a valid shoe size.');
    expect(problem(piece({ condition: 'mint' }))).toBe('Pick a condition.');
    expect(problem(piece({ intent: 'swap' }))).toMatch(/rent, for sale, or both/);
    expect(problem(piece({ occasions: ['gameday', 'brunch'] }))).toBe('Pick valid occasions.');
  });

  it('refuses junk instead of crashing', () => {
    expect(problem(null)).toBe('That piece did not come through.');
    expect(problem(piece({ listingId: 'a/b' }))).toBe('That piece did not come through.');
    expect(problem(piece({ name: 42 }))).toBe('That name did not come through.');
    expect(problem(piece({ photos: 'lots' }))).toBe('Add at least one photo.');
  });

  it('counts the same occasion once', () => {
    expect(parseListingInput(piece({ occasions: ['formal', 'formal'] })).occasions).toEqual([
      'formal',
    ]);
  });

  it('treats a missing "Available now" as on, and anything but true as not new', () => {
    expect(parseListingInput(piece({ availableNow: undefined })).availableNow).toBe(true);
    expect(parseListingInput(piece({ isNew: 'yes' })).isNew).toBe(false);
  });
});

describe('acceptPhoto', () => {
  it('accepts her own upload for this piece', () => {
    expect(photoProblem(photo())).toBe('ok');
    expect(photoProblem(photo({ bytes: undefined }))).toBe('ok');
  });

  it('refuses a picture from anywhere else on the internet', () => {
    expect(photoProblem(photo({ url: 'https://example.com/dress.jpg' }))).toMatch(/upload/);
  });

  it('refuses a photo in someone else’s folder, or another piece’s', () => {
    const theirs = `users/uid-someone/listings/${LISTING}/0.jpg`;
    expect(photoProblem(photo({ path: theirs, url: urlFor(theirs) }))).toMatch(/upload/);
    const other = `users/${UID}/listings/piece-2/0.jpg`;
    expect(photoProblem(photo({ path: other, url: urlFor(other) }))).toMatch(/upload/);
  });

  it('refuses a link that is not the file it claims to be', () => {
    expect(photoProblem(photo({ url: urlFor(`${FOLDER}other.jpg`) }))).toMatch(/upload/);
  });

  it('refuses sneaky paths and broken sizes', () => {
    const sneaky = `${FOLDER}../../../uid-someone/profile/a.jpg`;
    expect(photoProblem(photo({ path: sneaky, url: urlFor(sneaky) }))).toMatch(/upload/);
    expect(photoProblem(photo({ path: FOLDER, url: urlFor(FOLDER) }))).toMatch(/upload/);
    expect(photoProblem(photo({ width: 0 }))).toMatch(/upload/);
    expect(photoProblem(photo({ height: Number.NaN }))).toMatch(/upload/);
    expect(photoProblem('a photo')).toMatch(/upload/);
  });

  it('keeps a photo already on the piece exactly as it was, wherever it lives', () => {
    // Seeded pieces carry inline photos; an older piece may predate the
    // folder check. Editing the name must never fail on those.
    const old = { path: 'seed/1.jpg', url: 'data:image/jpeg;base64,AAAA', width: 600, height: 800 };
    expect(acceptPhoto({ ...old }, UID, LISTING, [old])).toBe(old);
    // ...but only that exact photo: same path, different link is new.
    expect(photoProblem({ ...old, url: 'https://example.com/x.jpg' }, [old])).toMatch(/upload/);
  });

  it('only stores the fields a photo has', () => {
    const kept = acceptPhoto(photo({ extra: 'nope' }), UID, LISTING, []);
    expect(Object.keys(kept).sort()).toEqual(['bytes', 'height', 'path', 'url', 'width']);
  });
});
