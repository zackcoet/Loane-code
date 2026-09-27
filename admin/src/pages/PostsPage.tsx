import type { AdminData } from '../data/adminData';
import { matchesCampus } from '../data/adminData';
import { ModerationGrid } from '../components/media';
import { Panel } from '../components/ui';

export function PostsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const posts = data.posts.filter((post) => matchesCampus(post, campusId));

  return (
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
          actionLabel: 'Hide post',
        }))}
      />
    </Panel>
  );
}
