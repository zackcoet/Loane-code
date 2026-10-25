/**
 * Small checks for what a phone sends to a callable.
 *
 * A callable's `request.data` is whatever the caller put there — the
 * TypeScript types on it are a hope, not a guarantee. These turn junk
 * into a clear answer instead of a crash deep inside a query.
 */

/** A Firestore document id: a short non-empty string with no slash. */
export function isDocId(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim() !== '' && value.length <= 128 && !value.includes('/')
  );
}

/** A plain `{ ... }` object (not an array, not null). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
