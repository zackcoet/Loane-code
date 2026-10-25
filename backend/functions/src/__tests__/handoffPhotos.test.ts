/**
 * Drop-off, return and problem photos must be her own uploads for this
 * rental. Pure — no emulator needed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkHandoffPhotos } from '../bookings/handoffPhotos';

const ME = 'uid-lender';
const BOOKING = 'booking-1';
const BUCKET = 'demo-loane.firebasestorage.app';

function photo(path: string, overrides: Record<string, unknown> = {}) {
  return {
    path,
    url: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=t`,
    width: 800,
    height: 1000,
    ...overrides,
  };
}

const saved = { ...process.env };
beforeAll(() => {
  process.env.GCLOUD_PROJECT = 'demo-loane';
  delete process.env.FUNCTIONS_EMULATOR;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  delete process.env.STORAGE_BUCKET;
});
afterAll(() => {
  process.env = saved;
});

describe('checkHandoffPhotos', () => {
  it('accepts her own upload for this rental', () => {
    const p = photo(`users/${ME}/bookings/${BOOKING}/drop.jpg`);
    expect(checkHandoffPhotos([p], ME, BOOKING)).toEqual([
      { path: p.path, url: p.url, width: 800, height: 1000 },
    ]);
  });

  it('treats nothing as no photos', () => {
    expect(checkHandoffPhotos(undefined, ME, BOOKING)).toEqual([]);
    expect(checkHandoffPhotos(null, ME, BOOKING)).toEqual([]);
  });

  it("refuses the other girl's photo, another rental's, and a piece photo", () => {
    for (const path of [
      `users/uid-renter/bookings/${BOOKING}/drop.jpg`,
      `users/${ME}/bookings/booking-2/drop.jpg`,
      `users/${ME}/listings/l1/0.jpg`,
      `users/${ME}/bookings/${BOOKING}/../../listings/l1/0.jpg`,
    ]) {
      expect(() => checkHandoffPhotos([photo(path)], ME, BOOKING)).toThrow(/did not upload/);
    }
  });

  it('refuses a link to some other picture', () => {
    const p = photo(`users/${ME}/bookings/${BOOKING}/drop.jpg`, {
      url: 'https://example.com/stain.jpg',
    });
    expect(() => checkHandoffPhotos([p], ME, BOOKING)).toThrow(/did not upload/);
    const other = photo(`users/${ME}/bookings/${BOOKING}/drop.jpg`, {
      url: photo(`users/${ME}/bookings/${BOOKING}/other.jpg`).url,
    });
    expect(() => checkHandoffPhotos([other], ME, BOOKING)).toThrow(/did not upload/);
  });

  it('refuses broken sizes, junk and too many', () => {
    const path = `users/${ME}/bookings/${BOOKING}/drop.jpg`;
    expect(() => checkHandoffPhotos([photo(path, { width: 0 })], ME, BOOKING)).toThrow();
    expect(() => checkHandoffPhotos([photo(path, { height: NaN })], ME, BOOKING)).toThrow();
    expect(() => checkHandoffPhotos(['x'], ME, BOOKING)).toThrow(/did not upload/);
    expect(() => checkHandoffPhotos('x', ME, BOOKING)).toThrow(/did not come through/);
    expect(() => checkHandoffPhotos(Array(9).fill(photo(path)), ME, BOOKING)).toThrow(/Up to 8/);
  });
});
