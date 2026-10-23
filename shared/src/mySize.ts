/**
 * Discover's "My size" filter: does this piece come in her size?
 *
 * Her sizes are the ones on her profile (Edit Profile, or the size step
 * in "Get started"). Each category is checked against the matching one:
 * a dress against her dress size, a jacket against her tops size, shoes
 * against her shoe size.
 *
 * DELIBERATELY FORGIVING: a piece is only hidden when we KNOW it will
 * not fit — both her size and the piece's size are filled in and they
 * differ. Bags and jewelry have no size; a piece listed without a size
 * might fit; and a category she has not given a size for is not her
 * telling us anything. Hiding those would make "My size" look like
 * there is nothing on campus for her, which is the worse mistake.
 */

import type { Category } from './constants';
import type { Listing } from './types/listing';
import type { User } from './types/user';

export type MySizes = User['sizes'];

/** Which of her sizes a category is measured against. Null: one size fits all. */
export const CATEGORY_SIZE_FIELD: Record<Category, keyof MySizes | null> = {
  dresses: 'dresses',
  tops: 'tops',
  outerwear: 'tops',
  // A set is mostly bought by its top; most lenders list it that way.
  sets: 'tops',
  bottoms: 'bottoms',
  shoes: 'shoe',
  bags: null,
  accessories: null,
  jewelry: null,
};

/** True if she has given at least one size, so the filter can mean something. */
export function hasAnySize(sizes: MySizes | null | undefined): boolean {
  return Boolean(sizes && Object.values(sizes).some((s) => s != null));
}

export function fitsMySizes(
  listing: Pick<Listing, 'category' | 'size' | 'shoeSize'>,
  sizes: MySizes | null | undefined,
): boolean {
  if (!sizes) return true;
  const field = CATEGORY_SIZE_FIELD[listing.category];
  if (!field) return true;
  const mine = sizes[field];
  const theirs = field === 'shoe' ? listing.shoeSize : listing.size;
  if (mine == null || theirs == null) return true;
  return mine === theirs;
}
