import { useState } from 'react';
import type { AdminData } from '../data/adminData';
import { matchesCampus } from '../data/adminData';
import { ModerationGrid } from '../components/media';
import { Panel } from '../components/ui';
import { ActionDialog } from '../components/ActionDialog';
import { adminErrorMessage, hidePost, restorePost } from '../data/adminActions';

export function PostsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  // Taking something down and putting it back both need a reason,
  // because both write an audit row.
  const [target, setTarget] = useState<{ id: string; hide: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async (reason: string) => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await (target.hide ? hidePost : restorePost)({ id: target.id, reason });
      setTarget(null);
    } catch (err) {
      setError(adminErrorMessage(err, 'Could not do that.'));
    } finally {
      setBusy(false);
    }
  };

  const posts = data.posts.filter((post) => matchesCampus(post, campusId));

  return (
    <>
      <Panel title="Posts" kicker={`${posts.length} loaded`}>
        <ModerationGrid
          emptyTitle="No posts yet"
          items={posts.map((post) => ({
            id: post.id,
            imageUrl: post.photos[0]?.url ?? null,
            title: post.caption || 'Untitled post',
            subtitle: post.author.displayName,
            status: post.status,
            meta: `${post.stats.viewCount} views · ${post.stats.likeCount} likes · ${post.stats.tagTapCount} tagged-item taps`,
            actionLabel: post.status === 'suspended' ? 'Put it back' : 'Hide post',
          }))}
          // Without this the grid disables its own button — the dialog,
          // the state and the hidePost call below it were all wired up to
          // something that could never be clicked.
          onAction={(id, status) => setTarget({ id, hide: status !== 'suspended' })}
        />
      </Panel>

      <ActionDialog
        open={target !== null}
        title={target?.hide ? 'Take this down?' : 'Put this back up?'}
        description={
          target?.hide
            ? 'It comes out of the marketplace and she is told why. Nothing is deleted.'
            : 'It becomes visible on her campus again.'
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
