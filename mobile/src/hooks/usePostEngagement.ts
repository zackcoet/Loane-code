/**
 * Liking and saving a post.
 *
 * Both edges use a `{uid}_{postId}` id, so the question "have I liked
 * this?" is one cheap point read. Writing goes through Cloud Functions
 * because both drive a visible count.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS, ids, withoutBlocked, type Post, type PostSave } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { likePost, savePost, unlikePost, unsavePost } from '../firebase/callables';
import { logEvent } from '../analytics/events';
import { hapticLike } from '../haptics';
import { readPostsInOrder } from './readPostsInOrder';
import { useHiddenUids } from './useBlocks';
import { useRetry } from './useRetry';

type Kind = 'like' | 'save';

function useEdge(kind: Kind, postId: string | undefined) {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid || !postId) {
      setOn(false);
      return;
    }
    const path = kind === 'like' ? COLLECTIONS.likes : COLLECTIONS.postSaves;
    const id = kind === 'like' ? ids.like(uid, postId) : ids.postSave(uid, postId);
    return onSnapshot(
      doc(db, path, id),
      (snap) => setOn(snap.exists()),
      () => setOn(false),
    );
  }, [kind, uid, postId]);

  const toggle = useCallback(async () => {
    if (!postId || busy) return;
    setBusy(true);
    // Flip straight away; the snapshot corrects it if the call fails.
    const next = !on;
    setOn(next);
    // Felt on the way on, not the way off — like Instagram.
    if (next) hapticLike();
    try {
      if (kind === 'like') {
        await (next ? likePost : unlikePost)({ postId });
        logEvent(next ? 'post_like' : 'post_unlike', {
          surface: 'feed',
          targetType: 'post',
          targetId: postId,
        });
      } else {
        await (next ? savePost : unsavePost)({ postId });
        logEvent(next ? 'post_save' : 'post_unsave', {
          surface: 'feed',
          targetType: 'post',
          targetId: postId,
        });
      }
    } catch {
      setOn(!next);
    } finally {
      setBusy(false);
    }
  }, [kind, postId, on, busy]);

  return { on, toggle, busy };
}

export const useIsLiked = (postId: string | undefined) => useEdge('like', postId);
export const useIsPostSaved = (postId: string | undefined) => useEdge('save', postId);

/** Looks she has saved, newest first. Feeds the Wishlist's Looks tab. */
export function useSavedPosts() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { attempt, retry } = useRetry();

  useEffect(() => {
    setFailed(false);
    if (!uid) {
      setPosts([]);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);

    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.postSaves),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(60),
      ),
      (snap) => {
        const postIds = snap.docs.map((d) => (d.data() as PostSave).postId);
        if (postIds.length === 0) {
          if (live) {
            setPosts([]);
            setLoading(false);
          }
          return;
        }
        void readPostsInOrder(postIds)
          .then((found) => {
            if (!live) return;
            setPosts(found);
            setLoading(false);
          })
          .catch(() => {
            if (!live) return;
            setFailed(true);
            setLoading(false);
          });
      },
      () => {
        if (!live) return;
        setFailed(true);
        setLoading(false);
      },
    );

    return () => {
      live = false;
      unsubscribe();
    };
  }, [uid, attempt]);

  // Looks by someone blocked either way drop out, like everywhere else.
  const hidden = useHiddenUids();
  const visible = useMemo(() => withoutBlocked(posts, (p) => p.authorUid, hidden), [posts, hidden]);

  return { posts: visible, loading, failed, retry };
}
