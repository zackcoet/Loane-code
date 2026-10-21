import { describe, expect, it } from 'vitest';
import { storagePaths } from '../collections';
import { thumbnailPathFor, thumbnailUrlFor, wantsThumbnail } from '../thumbnails';

const LISTING = storagePaths.listingPhoto('uid-ella', 'l1', '1700000000-0.jpg');
const POST = storagePaths.postPhoto('uid-ella', 'p1', 'a.jpg');

describe('wantsThumbnail', () => {
  it('is true for listing and post photos', () => {
    expect(wantsThumbnail(LISTING)).toBe(true);
    expect(wantsThumbnail(POST)).toBe(true);
  });

  it('is false for thumbnails, so the function never triggers itself', () => {
    expect(wantsThumbnail('users/uid-ella/listings/l1/thumbs/1700000000-0.webp')).toBe(false);
  });

  it('is false for every private or unrelated folder', () => {
    expect(wantsThumbnail(storagePaths.profilePhoto('u', 'a.jpg'))).toBe(false);
    expect(wantsThumbnail(storagePaths.messagePhoto('u', 'a.jpg'))).toBe(false);
    expect(wantsThumbnail(storagePaths.bookingPhoto('u', 'b', 'a.jpg'))).toBe(false);
    expect(wantsThumbnail(storagePaths.claimPhoto('u', 'c', 'a.jpg'))).toBe(false);
    expect(wantsThumbnail(storagePaths.tryOnBodyPhoto('u', 'a.jpg'))).toBe(false);
    expect(wantsThumbnail(storagePaths.tryOnResult('u', 'a.jpg'))).toBe(false);
  });
});

describe('thumbnailPathFor', () => {
  it('puts a webp in a thumbs folder beside the photo', () => {
    expect(thumbnailPathFor(LISTING)).toBe('users/uid-ella/listings/l1/thumbs/1700000000-0.webp');
    expect(thumbnailPathFor('users/u/posts/p/cutout.png')).toBe(
      'users/u/posts/p/thumbs/cutout.webp',
    );
  });

  it('handles a file with no extension', () => {
    expect(thumbnailPathFor('users/u/posts/p/photo')).toBe('users/u/posts/p/thumbs/photo.webp');
  });

  it('is null for a folder that gets no thumbnail', () => {
    expect(thumbnailPathFor(storagePaths.messagePhoto('u', 'a.jpg'))).toBeNull();
  });
});

describe('thumbnailUrlFor', () => {
  it('swaps the path in a real download URL and drops the token', () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/loane.appspot.com/o/' +
      encodeURIComponent(LISTING) +
      '?alt=media&token=abc-123';
    expect(thumbnailUrlFor(url)).toBe(
      'https://firebasestorage.googleapis.com/v0/b/loane.appspot.com/o/' +
        encodeURIComponent('users/uid-ella/listings/l1/thumbs/1700000000-0.webp') +
        '?alt=media',
    );
  });

  it('works on an emulator URL', () => {
    const url =
      'http://192.168.1.20:9199/v0/b/demo-loane.appspot.com/o/' +
      encodeURIComponent(POST) +
      '?alt=media&token=t';
    expect(thumbnailUrlFor(url)).toBe(
      'http://192.168.1.20:9199/v0/b/demo-loane.appspot.com/o/' +
        encodeURIComponent('users/uid-ella/posts/p1/thumbs/a.webp') +
        '?alt=media',
    );
  });

  it('is null for a URL that is not a Firebase listing or post photo', () => {
    expect(thumbnailUrlFor('https://picsum.photos/400')).toBeNull();
    expect(thumbnailUrlFor(null)).toBeNull();
    expect(thumbnailUrlFor('')).toBeNull();
    const message =
      'https://firebasestorage.googleapis.com/v0/b/x/o/' +
      encodeURIComponent(storagePaths.messagePhoto('u', 'a.jpg')) +
      '?alt=media&token=t';
    expect(thumbnailUrlFor(message)).toBeNull();
  });

  it('is null for a malformed encoded path rather than throwing', () => {
    expect(
      thumbnailUrlFor('https://firebasestorage.googleapis.com/v0/b/x/o/%E0%A4%A?alt=media'),
    ).toBeNull();
  });
});
