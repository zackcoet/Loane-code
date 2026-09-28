/**
 * The posts behind a list of ids, in that order, active ones only.
 *
 * Shared by Liked and Saved, which are the same job twice.
 *
 * Plain reads. Both hooks used to do this with a nested onSnapshot that
 * unsubscribed itself inside its own first callback — a getDocs written
 * the hard way, which also referenced its own `unsub` before it was
 * assigned. The edge listener above is what tells us the list changed,
 * so the inner read never needed to be live.
 */

import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Post } from '@loane/shared';
import { db } from '../firebase/config';

export async function readPostsInOrder(ids: string[]): Promise<Post[]> {
  const found = new Map<string, Post>();
  // `in` takes at most thirty values.
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    if (chunk.length === 0) continue;
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.posts), where(documentId(), 'in', chunk)),
    );
    for (const d of snap.docs) found.set(d.id, { ...(d.data() as Post), id: d.id });
  }
  return ids
    .map((id) => found.get(id))
    .filter((p): p is Post => p !== undefined && p.status === 'active');
}
