/**
 * Recent searches on Discover, and spotting an occasion in what she types.
 *
 * Recent searches live on her phone only (like Instagram's, they are a
 * convenience, not data we need), so this file is just the list rules:
 * newest first, no duplicates whatever the capitals, capped.
 */

import { OCCASIONS, OCCASION_LABELS, type Occasion } from './constants';

/** How many recent searches she keeps. */
export const MAX_RECENT_SEARCHES = 10;

/** Shorter than this is a half-typed word, not a search worth keeping. */
export const MIN_RECENT_SEARCH_LENGTH = 2;

/** Puts a search at the top, dropping an older copy and the oldest past the cap. */
export function addRecentSearch(list: readonly string[], term: string): string[] {
  const clean = term.trim().replace(/\s+/g, ' ');
  if (clean.length < MIN_RECENT_SEARCH_LENGTH) return [...list];
  const key = clean.toLowerCase();
  return [clean, ...list.filter((t) => t.toLowerCase() !== key)].slice(0, MAX_RECENT_SEARCHES);
}

/** Takes one search out of the list. */
export function removeRecentSearch(list: readonly string[], term: string): string[] {
  const key = term.toLowerCase();
  return list.filter((t) => t.toLowerCase() !== key);
}

/**
 * Occasions whose name starts with what she typed ("form" → Formal,
 * "date" → Date Function, "going" → Going Out). Any word of the name
 * counts, so "out" finds Going Out too.
 */
export function matchingOccasions(term: string): Occasion[] {
  const q = term.trim().toLowerCase();
  if (q.length < MIN_RECENT_SEARCH_LENGTH) return [];
  return OCCASIONS.filter((o) => {
    const label = OCCASION_LABELS[o].toLowerCase();
    return label.startsWith(q) || label.split(' ').some((word) => word.startsWith(q));
  });
}
