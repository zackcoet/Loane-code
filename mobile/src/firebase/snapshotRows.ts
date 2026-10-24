/**
 * Turns a live query's latest snapshot into rows, KEEPING the same
 * object for every document that did not change since the last one.
 *
 * Why: Firestore hands back every document again whenever any one of
 * them changes — a like on one look, a save on one piece. Rebuilding all
 * of them as new objects makes every card on screen re-draw, even the
 * ones that are identical. The feed and Discover cards are memo'd and
 * skip the re-draw when their row is the same object, so reusing
 * unchanged rows is what lets that work.
 *
 * Safe on the first snapshot of a new listener: Firestore lists every
 * document in it as changed ("added"), so nothing stale carries over.
 * Metadata-only updates (a write confirming) are not changes and keep
 * the old row, whose data is identical.
 */

import type { DocumentData, QuerySnapshot } from 'firebase/firestore';

export function snapshotRows<T extends { id: string }>(
  current: readonly T[],
  snap: QuerySnapshot<DocumentData>,
): T[] {
  const changed = new Set(snap.docChanges().map((c) => c.doc.id));
  const before = new Map(current.map((row) => [row.id, row]));
  return snap.docs.map(
    (d) => (!changed.has(d.id) && before.get(d.id)) || ({ ...d.data(), id: d.id } as T),
  );
}
