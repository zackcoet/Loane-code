/**
 * Real photographs for the seed.
 *
 * WHY FILES, INLINED AS DATA URIS.
 *
 * They are committed to the repo rather than downloaded at seed time so
 * seeding works with no network. They are inlined into Firestore rather
 * than uploaded to the Storage emulator because an emulator download URL
 * embeds the host it was made on — `127.0.0.1` — which a phone cannot
 * reach. That exact problem cost an evening once already.
 *
 * They replace flat grey rectangles. Grey blocks made it impossible to
 * judge whether the app looked right, and on a phone an unloaded image
 * and a grey block are the same thing.
 *
 * All Unsplash, used under the Unsplash Licence. Credits in
 * seed-images/ATTRIBUTION.md. These are placeholders: at launch, every
 * photo is a student's own photo of her own clothes.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, 'seed-images');

function load(prefix: string): string[] {
  const files = readdirSync(DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.jpg'))
    .sort();

  if (files.length === 0) {
    throw new Error(
      `No ${prefix} photos in ${DIR}. They are committed to the repo — try a fresh checkout.`,
    );
  }

  return files.map(
    (f) => `data:image/jpeg;base64,${readFileSync(join(DIR, f)).toString('base64')}`,
  );
}

/** Garments: rails, flatlays, single pieces. For listings. */
export const GARMENT_PHOTOS = load('garment-');

/** People wearing outfits. For posts and avatars. */
export const PEOPLE_PHOTOS = load('person-');

/** Deterministic, so the same listing gets the same photo every run. */
export function garmentPhoto(index: number): string {
  return GARMENT_PHOTOS[index % GARMENT_PHOTOS.length]!;
}

export function peoplePhoto(index: number): string {
  return PEOPLE_PHOTOS[index % PEOPLE_PHOTOS.length]!;
}

/**
 * The four garment photos Phase 0 proved are CLEAN — one garment, plain
 * background, nothing else in frame. They are the only seed photos
 * honest enough to use as lay-it-flat photos.
 *
 * A FLAT PHOTO IS THE GARMENT THE TRY-ON RENDERS. Handing them out by a
 * rotating cursor, as this first did, put a blue chambray shirt on a
 * listing called "Black Satin Slip Dress" — which is precisely the
 * failure the flat-photo gate exists to prevent, reproduced in our own
 * seed. So each file is now named, and the catalogue entry that uses it
 * describes that exact garment.
 *
 * Do not add to this list without re-running scripts/tryOnQualityTest.ts
 * against the file you are adding.
 */
export const FLAT_PHOTO_FILES = {
  poncho: 'garment-04.jpg',
  bomber: 'garment-12.jpg',
  chambray: 'garment-14.jpg',
  romper: 'garment-15.jpg',
} as const;

export type FlatPhotoKey = keyof typeof FLAT_PHOTO_FILES;

/** The named photo, inlined. See the note at the top of this file. */
export function flatPhoto(key: FlatPhotoKey): string {
  const file = FLAT_PHOTO_FILES[key];
  return `data:image/jpeg;base64,${readFileSync(join(DIR, file)).toString('base64')}`;
}
