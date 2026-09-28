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
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { COLLECTIONS, LIMITS, type Comment } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { addComment, deleteComment } from '../firebase/callables';
import { logEvent } from '../analytics/events';
import { callableErrorMessage } from '../firebase/errors';

export function useComments(postId: string | undefined) {
  const { profile } = useAuth();
  const [all, setAll] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!postId) {
      setAll([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.comments),
        where('postId', '==', postId),
        orderBy('createdAt', 'asc'),
        limit(200),
      ),
      (snap) => {
        setAll(snap.docs.map((d) => ({ ...(d.data() as Comment), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [postId]);

  const comments = useMemo(() => all.filter((c) => c.status === 'active'), [all]);

  const add = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!postId || !text || busy) return;
      if (text.length > LIMITS.commentBody.max) {
        throw new Error('That comment is too long.');
      }
      setBusy(true);
      try {
        await addComment({ postId, body: text });
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
      Boolean(profile) &&
      (comment.authorUid === profile?.uid || postAuthorUid === profile?.uid),
    [profile],
  );

  return { comments, loading, busy, add, remove, canDelete };
}
