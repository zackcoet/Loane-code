/**
 * The text worth running through the word filter after an edit: the
 * fields she actually changed (or all of them on a new document), joined
 * so one report covers one save. Null when nothing filterable changed,
 * so a price or photo edit costs no filter run at all.
 */
export function changedText<T extends object>(
  before: T | undefined,
  after: T,
  fields: readonly (keyof T)[],
): string | null {
  const parts: string[] = [];
  for (const field of fields) {
    const next = after[field];
    if (typeof next !== 'string' || next.trim() === '') continue;
    if (before && before[field] === next) continue;
    parts.push(next);
  }
  return parts.length > 0 ? parts.join('\n') : null;
}
