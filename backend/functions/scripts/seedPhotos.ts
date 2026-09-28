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
