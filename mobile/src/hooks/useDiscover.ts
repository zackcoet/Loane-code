/**
 * Discover's filtering, searching and sorting.
 *
 * HOW SEARCH WORKS TODAY, AND WHY
 *
 * One query goes to the server — "active listings on my campus, newest
 * first" — and everything after that happens on the phone. Typing narrows
 * what is already loaded, so it feels instant, costs nothing extra, and
 * works with a bad signal.
 *
 * That is a deliberate choice, not a shortcut. Firestore needs a
 * pre-built index for every combination of filter and sort; size x
 * category x price x occasion x three sort orders is dozens of indexes,
 * and it still cannot do a price range alongside a different sort field.
 *
 * WHERE IT BREAKS: a campus holding more than roughly 1,500 listings.
 * Past that the initial load gets slow and expensive, and we still cannot
 * do typo tolerance — "dres" will never find "dress" this way.
 *
 * WHAT WE SWITCH TO: a real search service, Typesense or Algolia. A Cloud
 * Function mirrors listings into it on every change and the app queries
 * that instead. Roughly a day's work. See docs/roadmap.md.
 */

import { useMemo, useState } from 'react';
import type { Category, Listing, Occasion, Size } from '@loane/shared';

export const SORTS = ['newest', 'price_low', 'price_high'] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  newest: 'Newest',
  price_low: 'Price: low to high',
  price_high: 'Price: high to low',
};

export interface Filters {
  sizes: Size[];
  categories: Category[];
  occasions: Occasion[];
  /** Whole dollars, as typed. Empty means no bound. */
  minPrice: string;
  maxPrice: string;
  /** Hide pieces the owner has paused. */
  availableOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  sizes: [],
  categories: [],
  occasions: [],
  minPrice: '',
  maxPrice: '',
  availableOnly: false,
};

/** The price we sort and filter on: rental first, else the sale price. */
function priceOf(listing: Listing): number | null {
  return listing.pricing.threeDayCents ?? listing.salePriceCents ?? null;
}

export function countActiveFilters(filters: Filters): number {
  return (
    filters.sizes.length +
    filters.categories.length +
    filters.occasions.length +
    (filters.minPrice.trim() ? 1 : 0) +
    (filters.maxPrice.trim() ? 1 : 0) +
    (filters.availableOnly ? 1 : 0)
  );
}

function toCents(input: string): number | null {
  const value = Number(input.trim().replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

interface Options {
  listings: Listing[];
  search: string;
  filters: Filters;
  sort: Sort;
  /** Explore shows everyone; Following narrows to these uids. */
  followingUids?: Set<string> | null;
}

export function useDiscoverResults({
  listings,
  search,
  filters,
  sort,
  followingUids,
}: Options): Listing[] {
  return useMemo(() => {
    const term = search.trim().toLowerCase();
    const min = toCents(filters.minPrice);
    const max = toCents(filters.maxPrice);

    const matched = listings.filter((listing) => {
      if (followingUids && !followingUids.has(listing.ownerUid)) return false;
      if (filters.availableOnly && listing.status !== 'active') return false;

      if (filters.sizes.length > 0) {
        if (!listing.size || !filters.sizes.includes(listing.size)) return false;
      }
      if (filters.categories.length > 0 && !filters.categories.includes(listing.category)) {
        return false;
      }
      // Any selected occasion matching is enough — a dress that works for
      // a formal AND a wedding should show up under either.
      if (filters.occasions.length > 0) {
        if (!listing.occasions.some((o) => filters.occasions.includes(o))) return false;
      }

      const price = priceOf(listing);
      if (min != null && (price == null || price < min)) return false;
      if (max != null && (price == null || price > max)) return false;

      if (term) {
        const haystack = [listing.name, listing.brand ?? '', listing.owner.username]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      return true;
    });

    if (sort === 'newest') return matched;

    // Pieces with no price sink to the bottom either way.
    return [...matched].sort((a, b) => {
      const pa = priceOf(a);
      const pb = priceOf(b);
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return sort === 'price_low' ? pa - pb : pb - pa;
    });
  }, [listings, search, filters, sort, followingUids]);
}

/** Small holder so the screen stays readable. */
export function useDiscoverState() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<Sort>('newest');
  return { search, setSearch, filters, setFilters, sort, setSort };
}
