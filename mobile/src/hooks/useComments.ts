/**
 * Comments on a look.
 *
 * Read live from Firestore so a new comment appears for everyone
 * watching the post; written through Cloud Functions, because the count
 * under the post has to move with the comment and the name on it has to
 * really be hers.
 *
 * Removed and suspended comments are filtered here rather than in the
 * query, so a comment coming down does not need an index and does not
 * shift under anyone mid-scroll — the listener just stops returning it.
 *
 * PAGED BY GROWING THE LISTENER. Comments read oldest first, so the
 * newest are at the bottom. The listener starts with one page and grows
 * by a page each time she nears the end, rather than adding one-shot
 * older pages the way the feed and chats do: here the page that changes
 * (new comments) is the LAST one, and a growing window keeps every
 * comment she can see live with no gap at the seams. A post with
 * hundreds of comments is not a thing a campus app has yet; if one
 * appears, this is the place to revisit.
 *
 * When she posts, the window jumps to the old ceiling (200) so her own
 * comment is there when the list scrolls down to it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS, LIMITS, PAGE_SIZES, type Comment, type CommentLike } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { addComment, deleteComment, likeComment, unlikeComment } from '../firebase/callables';
import { logEvent } from '../analytics/events';
import { hapticLike, hapticSend } from '../haptics';
import { callableErrorMessage } from '../firebase/errors';
import { isCachedEmpty } from '../network/connection';

/** The most a post's comments listener will ever hold. */
const MAX_COMMENTS = 200;

export function useComments(postId: string | undefined) {
  const { profile } = useAuth();
  const [all, setAll] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  /** How many comments the listener holds. Grows a page at a time. */
  const [windowSize, setWindowSize] = useState<number>(PAGE_SIZES.comments);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Bumped by retry, to listen again. */
  const [attempt, setAttempt] = useState(0);

  // A different post starts from one page again.
  useEffect(() => {
    setWindowSize(PAGE_SIZES.comments);
    setLoading(true);
  }, [postId]);

  useEffect(() => {
    if (!postId) {
      setAll([]);
      setLoading(false);
      return;
    }
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.comments),
        where('postId', '==', postId),
        orderBy('createdAt', 'asc'),
        limit(windowSize),
      ),
      (snap) => {
        // No signal and nothing cached: an empty answer here is a guess,
        // not "you have none". Say it could not load (shared/connection.ts).
        if (isCachedEmpty(snap)) {
          setError(true);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        setAll(snap.docs.map((d) => ({ ...(d.data() as Comment), id: d.id })));
        // Counted before removed comments are filtered out, so a page
        // full of takedowns still knows there is more behind it.
        setHasMore(snap.docs.length >= windowSize && windowSize < MAX_COMMENTS);
        setError(false);
        setLoading(false);
        setLoadingMore(false);
      },
      () => {
        setError(true);
        setLoading(false);
        setLoadingMore(false);
      },
    );
  }, [postId, windowSize, attempt]);

  /** Near the bottom: hold one more page. */
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    setWindowSize((n) => Math.min(n + PAGE_SIZES.comments, MAX_COMMENTS));
  }, [hasMore, loadingMore, loading]);

  /** After an error: listen again from the same window. */
  const retry = useCallback(() => {
    setError(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  /**
   * Which comments on this look she has hearted, live from the server.
   * One small query per open sheet: her hearts on this one look.
   */
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  /**
   * Taps not yet confirmed, so the heart fills the moment she taps it.
   * Keyed by comment id: true = she just liked it, false = unliked.
   */
  const [pendingLikes, setPendingLikes] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!postId || !profile) {
      setLikedIds(new Set());
      return;
    }
    // Two == filters and no sort — Firestore serves this without a
    // composite index.
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.commentLikes),
        where('uid', '==', profile.uid),
        where('postId', '==', postId),
      ),
      (snap) => {
        setLikedIds(new Set(snap.docs.map((d) => (d.data() as CommentLike).commentId)));
      },
      // Hearts failing to load is not worth an error screen; the
      // comments still read fine with every heart empty.
      () => setLikedIds(new Set()),
    );
  }, [postId, profile]);

  const comments = useMemo(() => all.filter((c) => c.status === 'active'), [all]);

  /** Has she hearted this comment (counting a tap still on its way)? */
  const isLiked = useCallback(
    (commentId: string) => pendingLikes.get(commentId) ?? likedIds.has(commentId),
    [pendingLikes, likedIds],
  );

  /**
   * The count to show: the server's, nudged by a tap still on its way so
   * the number moves with the heart instead of a second later.
   */
  const likeCountOf = useCallback(
    (comment: Comment) => {
      const base = comment.likeCount ?? 0;
      const pending = pendingLikes.get(comment.id);
      if (pending === undefined || pending === likedIds.has(comment.id)) return base;
      return Math.max(0, base + (pending ? 1 : -1));
    },
    [pendingLikes, likedIds],
  );

  const toggleLike = useCallback(
    async (comment: Comment) => {
      const next = !isLiked(comment.id);
      if (next) hapticLike();
      setPendingLikes((m) => new Map(m).set(comment.id, next));
      try {
        await (next ? likeComment : unlikeComment)({ commentId: comment.id });
        // Logged after the server agreed, like post_like, so a refused
        // heart never counts.
        logEvent(next ? 'comment_like' : 'comment_unlike', {
          surface: 'feed',
          targetType: 'post',
          targetId: postId ?? null,
          meta: { commentId: comment.id },
        });
      } catch (err) {
        throw new Error(callableErrorMessage(err, 'Could not do that just now.'));
      } finally {
        // The live listeners now carry the truth either way.
        setPendingLikes((m) => {
          const copy = new Map(m);
          copy.delete(comment.id);
          return copy;
        });
      }
    },
    [isLiked, postId],
  );

  /**
   * Comments in reading order: each top-level comment followed by its
   * replies, oldest first, with the depth the row should render at.
   *
   * Built here rather than in the screen so the screen stays a list.
   * A reply whose parent has since been deleted is promoted to the top
   * level instead of vanishing — it is still somebody's words, and
   * silently dropping it would look like a bug to whoever wrote it.
   */
  const threaded = useMemo(() => {
    const tops = comments.filter((c) => !c.parentCommentId);
    const topIds = new Set(tops.map((c) => c.id));
    const repliesByParent = new Map<string, Comment[]>();
    const orphans: Comment[] = [];

    for (const c of comments) {
      if (!c.parentCommentId) continue;
      if (!topIds.has(c.parentCommentId)) {
        orphans.push(c);
        continue;
      }
      const list = repliesByParent.get(c.parentCommentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentCommentId, list);
    }

    const out: { comment: Comment; depth: 0 | 1 }[] = [];
    for (const top of [...tops, ...orphans].sort(
      (a, b) => order(a.createdAt) - order(b.createdAt),
    )) {
      out.push({ comment: top, depth: 0 });
      for (const reply of repliesByParent.get(top.id) ?? []) {
        out.push({ comment: reply, depth: 1 });
      }
    }
    return out;
  }, [comments]);

  const add = useCallback(
    async (body: string, parentCommentId?: string) => {
      const text = body.trim();
      if (!postId || !text || busy) return;
      if (text.length > LIMITS.commentBody.max) {
        throw new Error('That comment is too long.');
      }
      setBusy(true);
      try {
        await addComment({ postId, body: text, parentCommentId });
        hapticSend();
        // Her comment is the newest, so the last in the list: make sure
        // the window reaches it.
        setWindowSize(MAX_COMMENTS);
        logEvent('comment_created', {
          surface: 'feed',
          targetType: 'post',
          targetId: postId,
        });
      } catch (err) {
        throw new Error(callableErrorMessage(err, 'Could not post that comment.'));
      } finally {
        setBusy(false);
      }
    },
    [postId, busy],
  );

  const remove = useCallback(
    async (commentId: string) => {
      if (busy) return;
      setBusy(true);
      try {
        await deleteComment({ commentId });
        logEvent('comment_deleted', {
          surface: 'feed',
          targetType: 'post',
          targetId: postId ?? null,
        });
      } catch (err) {
        throw new Error(callableErrorMessage(err, 'Could not delete that comment.'));
      } finally {
        setBusy(false);
      }
    },
    [busy, postId],
  );

  /**
   * Whether the signed-in student may take a comment down: her own, or
   * anything on her own look.
   */
  const canDelete = useCallback(
    (comment: Comment, postAuthorUid: string | undefined) =>
      Boolean(profile) && (comment.authorUid === profile?.uid || postAuthorUid === profile?.uid),
    [profile],
  );

  return {
    comments,
    threaded,
    loading,
    busy,
    add,
    remove,
    canDelete,
    isLiked,
    likeCountOf,
    toggleLike,
    error,
    retry,
    hasMore,
    loadMore,
    loadingMore,
  };
}

/** Sortable milliseconds out of whatever a Firestore timestamp is. */
function order(value: unknown): number {
  const maybe = value as { toDate?: () => Date; seconds?: number } | null;
  if (maybe && typeof maybe.toDate === 'function') return maybe.toDate().getTime();
  if (maybe && typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  return 0;
}
