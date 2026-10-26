/**
 * Who a stored phone hash belongs to. Pure, so it is tested without the
 * emulator.
 *
 * WHY A LIST. Nobody proves a phone number is theirs — she types it in
 * Settings. Before, the last girl to save a number took it over: type
 * Ella's number into your own settings and Ella's friends would find
 * YOU under "Find friends from contacts", and stop finding Ella. And
 * when either of them later removed it, the hash was deleted outright,
 * so neither matched.
 *
 * So a hash now remembers everyone who has saved that number, and it
 * matches only while exactly one girl holds it. Two claims on one
 * number match nobody until one of them lets go — a squatter can hide
 * Ella from her friends' contacts, but can never be shown in her place.
 * See docs/decisions.md (2026-10-26, run 49).
 *
 * Older documents only have `uid`. They read as a list of one.
 */

export type PhoneHashRow = {
  /** The one account this number matches, or null when shared or empty. */
  uid?: string | null;
  /** Every account that has this number saved right now. */
  uids?: string[];
};

/** Everyone who holds the number, oldest first. */
export function holdersOf(row: PhoneHashRow | undefined): string[] {
  if (!row) return [];
  if (Array.isArray(row.uids)) return row.uids.filter((u) => typeof u === 'string' && u !== '');
  return typeof row.uid === 'string' && row.uid !== '' ? [row.uid] : [];
}

/** The account a contact with this number should be shown, if any. */
export function matchedUid(row: PhoneHashRow | undefined): string | null {
  const holders = holdersOf(row);
  return holders.length === 1 ? holders[0]! : null;
}

/** The fields to save for a set of holders, or null to delete the row. */
export function rowFor(holders: string[]): { uid: string | null; uids: string[] } | null {
  if (holders.length === 0) return null;
  return { uid: holders.length === 1 ? holders[0]! : null, uids: holders };
}
