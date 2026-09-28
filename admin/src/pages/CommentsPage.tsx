import { useMemo, useState } from 'react';
import type { Comment } from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { formatShortDate, matchesCampus } from '../data/adminData';
import { EmptyState, Panel, Pill, Toolbar } from '../components/ui';
import { ActionDialog } from '../components/ActionDialog';
import { adminErrorMessage, hideComment, restoreComment } from '../data/adminActions';

/**
 * Comments moderation.
 *
 * A table rather than the image grid the Posts page uses, because a
 * comment is text and the thing you need to read is the text.
 *
 * Newest first: a comment somebody just reported is the one that
 * matters, and a three-week-old thread has already been seen by
 * everyone it was going to upset.
 */

const STATUS_TONE: Record<Comment['status'], 'good' | 'warn' | 'neutral'> = {
  active: 'good',
  removed: 'neutral',
  suspended: 'warn',
};

export function CommentsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [target, setTarget] = useState<{ comment: Comment; hide: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comments = useMemo(
    () =>
      data.comments
        .filter((comment) => matchesCampus(comment, campusId))
        .filter((comment) => status === 'all' || comment.status === status)
        .filter((comment) => {
          const text = `${comment.body} ${comment.author.username}`.toLowerCase();
          return text.includes(query.toLowerCase().trim());
        }),
    [data.comments, campusId, status, query],
  );

  const apply = async (reason: string) => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await (target.hide ? hideComment : restoreComment)({ id: target.comment.id, reason });
      setTarget(null);
    } catch (err) {
      setError(adminErrorMessage(err, 'Could not do that.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Toolbar>
        <input
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search comment text or @username"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Taken down by us</option>
          <option value="removed">Deleted by her</option>
        </select>
      </Toolbar>

      <Panel title="Comments" kicker={`${comments.length} loaded and filtered`}>
        {comments.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Who</th>
                <th>Comment</th>
                <th>On post</th>
                <th>Posted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((comment) => (
                <tr key={comment.id}>
                  <td>
                    <Pill tone={STATUS_TONE[comment.status]}>{comment.status}</Pill>
                  </td>
                  <td>@{comment.author.username}</td>
                  <td>
                    {comment.body}
                    {comment.suspendedReason ? (
                      <div className="cell-note">Taken down: {comment.suspendedReason}</div>
                    ) : null}
                  </td>
                  <td className="cell-note">{comment.postId}</td>
                  <td>{formatShortDate(comment.createdAt)}</td>
                  <td>
                    {/* A comment she deleted herself stays deleted. Putting
                        it back would be us overriding her, which is not
                        moderation. */}
                    {comment.status === 'active' ? (
                      <button onClick={() => setTarget({ comment, hide: true })}>
                        Take it down
                      </button>
                    ) : comment.status === 'suspended' ? (
                      <button onClick={() => setTarget({ comment, hide: false })}>
                        Put it back
                      </button>
                    ) : (
                      <span className="cell-note">Deleted by her</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="No comments match"
            body="Comments students leave on looks show up here."
          />
        )}
      </Panel>

      <ActionDialog
        open={target !== null}
        title={target?.hide ? 'Take this comment down?' : 'Put this comment back?'}
        description={
          target?.hide
            ? 'It disappears from the look and she is told why. Nothing is deleted.'
            : 'It becomes visible under the look again.'
        }
        confirmLabel={target?.hide ? 'Take it down' : 'Restore it'}
        danger={error ?? undefined}
        busy={busy}
        onConfirm={(reason) => void apply(reason)}
        onClose={() => {
          setTarget(null);
          setError(null);
        }}
      />
    </>
  );
}
