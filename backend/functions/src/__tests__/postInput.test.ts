/**
 * Checking what the phone sends when she posts a look. No emulator
 * needed — these are pure checks.
 *
 *   - Each photo must be one she uploaded: her own folder, our bucket,
 *     and the link must be that exact file.
 *   - Junk input (wrong types, missing pieces, odd sizes) gets a clear
 *     answer instead of a crash.
 *   - The same occasion twice is counted once.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isDownloadUrlFor, parseInput } from '../posts/createPost';

const UID = 'uid-poster';
const PATH = `users/${UID}/posts/draft-1/0.jpg`;
const GOOGLE = 'https://firebasestorage.googleapis.com';

function urlFor(path: string, bucket = 'demo-loane.firebasestorage.app', host = GOOGLE) {
  return `${host}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=abc`;
}

function photo(overrides: Record<string, unknown> = {}) {
  return { path: PATH, url: urlFor(PATH), width: 1080, height: 1350, tags: [], ...overrides };
}

function problem(data: unknown): string {
  try {
    parseInput(data, UID);
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

describe('isDownloadUrlFor', () => {
  it('accepts our own download link for that exact file, in either bucket spelling', () => {
    expect(isDownloadUrlFor(urlFor(PATH), PATH)).toBe(true);
    expect(isDownloadUrlFor(urlFor(PATH, 'demo-loane.appspot.com'), PATH)).toBe(true);
  });

  it('refuses another site, another project, another file, and plain http', () => {
    expect(
      isDownloadUrlFor(
        urlFor(PATH, 'demo-loane.firebasestorage.app', 'https://evil.example'),
        PATH,
      ),
    ).toBe(false);
    expect(isDownloadUrlFor(urlFor(PATH, 'someone-else.appspot.com'), PATH)).toBe(false);
    expect(isDownloadUrlFor(urlFor(`users/${UID}/posts/draft-1/1.jpg`), PATH)).toBe(false);
    expect(isDownloadUrlFor(urlFor(PATH).replace('https:', 'http:'), PATH)).toBe(false);
    expect(isDownloadUrlFor('not a link', PATH)).toBe(false);
  });

  it('on the emulators, accepts the laptop as the host (a phone sees its wifi address)', () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    expect(isDownloadUrlFor(urlFor(PATH, undefined, 'http://192.168.1.20:9199'), PATH)).toBe(true);
    expect(
      isDownloadUrlFor(urlFor(PATH, 'someone-else.appspot.com', 'http://127.0.0.1:9199'), PATH),
    ).toBe(false);
    expect(isDownloadUrlFor(`javascript:alert(1)/v0/b/demo-loane.appspot.com/o/x`, PATH)).toBe(
      false,
    );
  });
});

describe('parseInput', () => {
  it('passes a normal look through, dropping extra fields and repeat occasions', () => {
    const input = parseInput(
      {
        photos: [photo({ tags: [{ listingId: 'l1', x: 0.5, y: 0.6, ownerUid: 'whoever' }] })],
        caption: 'gameday',
        occasions: ['gameday', 'gameday', 'formal'],
      },
      UID,
    );
    expect(input.photos[0]!.tags).toEqual([{ listingId: 'l1', x: 0.5, y: 0.6 }]);
    expect(input.occasions).toEqual(['gameday', 'formal']);
    expect(input.caption).toBe('gameday');
    expect(input.settings).toEqual({});
    expect(input.scheduledAt).toBeNull();
  });

  it("refuses a photo from someone else's folder or outside the looks folder", () => {
    for (const path of [
      'users/uid-other/posts/draft-1/0.jpg',
      `users/${UID}/listings/l1/0.jpg`,
      `users/${UID}/posts/../../uid-other/posts/0.jpg`,
      `users/${UID}/posts//0.jpg`,
    ]) {
      expect(problem({ photos: [photo({ path, url: urlFor(path) })] })).toMatch(/did not upload/);
    }
  });

  it('refuses a link that is not the uploaded file', () => {
    expect(problem({ photos: [photo({ url: 'https://evil.example/cat.jpg' })] })).toMatch(
      /did not upload/,
    );
    expect(problem({ photos: [photo({ url: 42 })] })).toMatch(/did not upload/);
  });

  it('refuses sizes that would break the look on everyone else’s feed', () => {
    for (const width of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 50_000, '1080', null]) {
      expect(problem({ photos: [photo({ width })] })).toMatch(/did not upload/);
    }
  });

  it('gives junk a clear answer', () => {
    expect(problem(undefined)).toMatch(/at least one photo/);
    expect(problem('hello')).toMatch(/at least one photo/);
    expect(problem({ photos: 'abc' })).toMatch(/at least one photo/);
    expect(problem({ photos: [] })).toMatch(/at least one photo/);
    expect(problem({ photos: Array.from({ length: 11 }, () => photo()) })).toMatch(/up to 10/);
    expect(problem({ photos: [null] })).toMatch(/did not upload/);
    expect(problem({ photos: [photo()], caption: 7 })).toMatch(/caption/);
    expect(problem({ photos: [photo()], caption: 'x'.repeat(1001) })).toMatch(/at most 1000/);
    expect(problem({ photos: [photo()], occasions: 'formal' })).toMatch(/valid occasions/);
    expect(problem({ photos: [photo()], occasions: ['brunch'] })).toMatch(/valid occasions/);
    expect(problem({ photos: [photo()], settings: 'yes' })).toMatch(/settings/);
    expect(problem({ photos: [photo()], scheduledAt: 12 })).toMatch(/schedule time/);
    expect(problem({ photos: [photo({ tags: 'l1' })] })).toMatch(/tags/);
    expect(problem({ photos: [photo({ tags: [{ listingId: 5, x: 0, y: 0 }] })] })).toMatch(
      /Tag it again/,
    );
    expect(problem({ photos: [photo({ tags: [{ listingId: 'a/b', x: 0, y: 0 }] })] })).toMatch(
      /Tag it again/,
    );
    expect(problem({ photos: [photo({ tags: [{ listingId: 'l1', x: 2, y: 0 }] })] })).toMatch(
      /outside its photo/,
    );
    expect(problem({ photos: [photo({ tags: [{ listingId: 'l1', x: '0.5', y: 0 }] })] })).toMatch(
      /outside its photo/,
    );
  });

  it('caps tags across all photos', () => {
    const tags = Array.from({ length: 4 }, (_, i) => ({ listingId: `l${i}`, x: 0.1, y: 0.1 }));
    expect(problem({ photos: [photo({ tags }), photo({ tags })] })).toMatch(/up to 6 pieces/);
  });
});
