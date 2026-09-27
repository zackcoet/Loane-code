import { CATEGORY_LABELS, type AppEvent, type User } from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { toDate } from '../data/adminData';
import { Avatar, MetricCard, Panel } from '../components/ui';
import { ThumbGrid, Timeline } from '../components/media';
import { campusName } from './UsersPage';

interface Props {
  user: User;
  data: AdminData;
  onBack: () => void;
}

export function UserDetailPage({ user, data, onBack }: Props) {
  const listings = data.listings.filter((listing) => listing.ownerUid === user.uid);
  const posts = data.posts.filter((post) => post.authorUid === user.uid);
  const events = recentUserEvents(data.events, user.uid);

  return (
    <>
      <button className="text-button back-button" onClick={onBack}>
        Back to users
      </button>
      <section className="profile-header">
        <Avatar user={user} />
        <div>
          <p className="label">{campusName(data.campuses, user.campusId)}</p>
          <h2>{user.displayName}</h2>
          <p className="muted">
            @{user.username} · {user.campusEmail ?? 'No school email recorded'}
          </p>
        </div>
        <div className="profile-actions">
          <button className="outline-button" disabled title="Needs a Cloud Function">
            {user.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
          </button>
        </div>
      </section>

      <section className="metric-grid four">
        <MetricCard label="Listings" value={listings.length} detail="Closet items loaded" />
        <MetricCard label="Posts" value={posts.length} detail="Looks shared" />
        <MetricCard label="As lender" value={user.stats.rentalsAsLender} detail="Completed rentals" />
        <MetricCard label="As renter" value={user.stats.rentalsAsRenter} detail="Completed rentals" />
      </section>

      <section className="two-column">
        <Panel title="Closet" kicker={`${listings.length} loaded items`}>
          <ThumbGrid
            items={listings.map((listing) => ({
              id: listing.id,
              title: listing.name,
              subtitle: `${CATEGORY_LABELS[listing.category]} · ${listing.status}`,
              imageUrl: listing.coverUrl,
            }))}
          />
        </Panel>
        <Panel title="Posts" kicker={`${posts.length} loaded looks`}>
          <ThumbGrid
            items={posts.map((post) => ({
              id: post.id,
              title: post.caption || 'Untitled post',
              subtitle: `${post.taggedListingIds.length} tagged items · ${post.status}`,
              imageUrl: post.photos[0]?.url ?? null,
            }))}
          />
        </Panel>
      </section>

      <section className="two-column">
        <Panel title="Activity Timeline" kicker="Recent app events">
          <Timeline events={events} />
        </Panel>
        <Panel title="Internal Admin Notes" kicker="Backend needed">
          <textarea
            disabled
            value="Admin notes need a private collection plus audit rules before this can save."
            readOnly
          />
        </Panel>
      </section>
    </>
  );
}

function recentUserEvents(events: AppEvent[], uid: string) {
  return events
    .filter((event) => event.uid === uid)
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
    .slice(0, 20);
}
