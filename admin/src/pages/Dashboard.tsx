import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import {
  BOOKING_STATUS_LABELS,
  CATEGORY_LABELS,
  LISTING_STATUSES,
  OCCASION_LABELS,
  OCCASIONS,
  type AppEvent,
  type Campus,
  type Occasion,
  type User,
} from '@loane/shared';
import { auth } from '../firebase/config';
import {
  type AdminData,
  type DateRangeKey,
  changeLabel,
  dayKey,
  downloadCsv,
  formatDate,
  formatMoney,
  formatShortDate,
  getDateWindow,
  humanize,
  isInPreviousWindow,
  isInWindow,
  loadAdminData,
  matchesCampus,
  toDate,
  weekKey,
} from '../data/adminData';

type Page =
  | 'overview'
  | 'users'
  | 'rentals'
  | 'listings'
  | 'posts'
  | 'reports'
  | 'claims'
  | 'campuses'
  | 'founding'
  | 'activity';

type SortKey = 'name' | 'createdAt' | 'lastActiveAt' | 'listings' | 'posts' | 'rentals';

const PAGE_LABELS: Record<Page, string> = {
  overview: 'Overview',
  users: 'Users',
  rentals: 'Rentals',
  listings: 'Listings',
  posts: 'Posts',
  reports: 'Reports',
  claims: 'Damage Claims',
  campuses: 'Campuses',
  founding: 'Founding Closets',
  activity: 'Activity Log',
};

const NAV: Page[] = [
  'overview',
  'users',
  'rentals',
  'listings',
  'posts',
  'reports',
  'claims',
  'campuses',
  'founding',
  'activity',
];

export function Dashboard({ adminEmail }: { adminEmail: string | null }) {
  const [page, setPage] = useState<Page>('overview');
  const [dateRange, setDateRange] = useState<DateRangeKey>('30d');
  const [campusId, setCampusId] = useState('all');
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    loadAdminData()
      .then(setData)
      .catch(() => setError('Could not load admin data. Check that the emulators are running.'));
  }, []);

  const selectedUser = data?.users.find((user) => user.uid === selectedUserId) ?? null;

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-mark" aria-label="Loane">
          <span>L</span>
          <span>O</span>
          <span>A</span>
          <span>N</span>
          <span>E</span>
        </div>
        <nav className="nav-list" aria-label="Admin navigation">
          {NAV.map((item) => (
            <button
              key={item}
              className={item === page ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                setPage(item);
                if (item !== 'users') setSelectedUserId(null);
              }}
            >
              {PAGE_LABELS[item]}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="label">Loane Admin</p>
            <h1>{selectedUser ? selectedUser.displayName : PAGE_LABELS[page]}</h1>
          </div>
          <div className="topbar-actions">
            {adminEmail ? <span className="muted">{adminEmail}</span> : null}
            <button className="text-button" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        </header>

        {error ? <p className="error">{error}</p> : null}
        {!data && !error ? <Loading /> : null}
        {data ? (
          <main className="content">
            {page === 'overview' ? (
              <OverviewPage
                data={data}
                dateRange={dateRange}
                campusId={campusId}
                onDateRangeChange={setDateRange}
                onCampusChange={setCampusId}
              />
            ) : null}
            {page === 'users' && !selectedUser ? (
              <UsersPage
                data={data}
                onSelectUser={(uid) => setSelectedUserId(uid)}
                campusId={campusId}
                onCampusChange={setCampusId}
              />
            ) : null}
            {page === 'users' && selectedUser ? (
              <UserDetailPage
                user={selectedUser}
                data={data}
                onBack={() => setSelectedUserId(null)}
              />
            ) : null}
            {page === 'rentals' ? <RentalsPage data={data} campusId={campusId} /> : null}
            {page === 'listings' ? <ListingsPage data={data} campusId={campusId} /> : null}
            {page === 'posts' ? <PostsPage data={data} campusId={campusId} /> : null}
            {page === 'reports' ? <ReportsPage data={data} campusId={campusId} /> : null}
            {page === 'claims' ? <ClaimsPage data={data} campusId={campusId} /> : null}
            {page === 'campuses' ? <CampusesPage campuses={data.campuses} /> : null}
            {page === 'founding' ? <FoundingClosetsPage data={data} campusId={campusId} /> : null}
            {page === 'activity' ? <ActivityLogPage data={data} /> : null}
          </main>
        ) : null}
      </section>
    </div>
  );
}

function OverviewPage({
  data,
  dateRange,
  campusId,
  onDateRangeChange,
  onCampusChange,
}: {
  data: AdminData;
  dateRange: DateRangeKey;
  campusId: string;
  onDateRangeChange: (value: DateRangeKey) => void;
  onCampusChange: (value: string) => void;
}) {
  const window = useMemo(() => getDateWindow(dateRange), [dateRange]);
  const scoped = useMemo(() => scopeData(data, campusId), [data, campusId]);
  const metrics = useMemo(() => makeOverviewMetrics(scoped, window), [scoped, window]);
  const funnel = useMemo(() => makeFunnel(scoped, window), [scoped, window]);
  const retention = useMemo(() => makeRetention(scoped.users, scoped.events), [scoped]);

  return (
    <>
      <Toolbar>
        <Segmented
          value={dateRange}
          options={[
            ['7d', '7 days'],
            ['30d', '30 days'],
            ['all', 'All time'],
          ]}
          onChange={(value) => onDateRangeChange(value as DateRangeKey)}
        />
        <CampusSelect campuses={data.campuses} value={campusId} onChange={onCampusChange} />
      </Toolbar>

      <section className="metric-grid">
        {metrics.headlines.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="dashboard-grid">
        <ChartCard title="Signups Over Time" points={metrics.signupsChart} />
        <ChartCard title="Active Users Over Time" points={metrics.activeUsersChart} />
        <ChartCard title="Listings Over Time" points={metrics.listingsChart} />
        <ChartCard title="Posts Over Time" points={metrics.postsChart} />
      </section>

      <section className="two-column">
        <Panel title="Activation Funnel" kicker="Signed up to rental completed">
          <Funnel rows={funnel} />
        </Panel>
        <Panel title="Retention" kicker="Signup cohorts returning later">
          {retention.length > 0 ? (
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Signup week</th>
                  <th>People</th>
                  <th>Next week</th>
                  <th>Later weeks</th>
                </tr>
              </thead>
              <tbody>
                {retention.map((row) => (
                  <tr key={row.week}>
                    <td>{row.week}</td>
                    <td>{row.signups}</td>
                    <td>{row.nextWeek}</td>
                    <td>{row.later}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No retention data yet" body="As students return after signup, cohorts will appear here." />
          )}
        </Panel>
      </section>
    </>
  );
}

function UsersPage({
  data,
  campusId,
  onCampusChange,
  onSelectUser,
}: {
  data: AdminData;
  campusId: string;
  onCampusChange: (value: string) => void;
  onSelectUser: (uid: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [joined, setJoined] = useState<DateRangeKey>('all');
  const [sort, setSort] = useState<SortKey>('createdAt');
  const joinedWindow = useMemo(() => getDateWindow(joined), [joined]);

  const users = useMemo(() => {
    return data.users
      .filter((user) => matchesCampus(user, campusId))
      .filter((user) => status === 'all' || user.status === status)
      .filter((user) => joined === 'all' || isInWindow(user.createdAt, joinedWindow))
      .filter((user) => {
        const text = `${user.displayName} ${user.username} ${user.campusEmail ?? ''}`.toLowerCase();
        return text.includes(query.toLowerCase().trim());
      })
      .sort((a, b) => sortUsers(a, b, sort));
  }, [campusId, data.users, joined, joinedWindow, query, sort, status]);

  const exportUsers = () => {
    downloadCsv(
      'loane-users.csv',
      users.map((user) => ({
        name: user.displayName,
        username: user.username,
        schoolEmail: user.campusEmail,
        campus: campusName(data.campuses, user.campusId),
        signupDate: formatDate(user.createdAt),
        lastActive: formatDate(user.lastActiveAt),
        listings: user.stats.listingCount,
        posts: user.stats.postCount,
        rentals: user.stats.rentalsAsLender + user.stats.rentalsAsRenter,
        status: user.status,
        emailConfirmed: user.verificationMethod === 'email_confirmed' ? 'yes' : 'no',
      })),
    );
  };

  return (
    <>
      <Toolbar>
        <input
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, username, or school email"
        />
        <CampusSelect campuses={data.campuses} value={campusId} onChange={onCampusChange} />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <select value={joined} onChange={(event) => setJoined(event.target.value as DateRangeKey)}>
          <option value="all">Any join date</option>
          <option value="7d">Joined last 7 days</option>
          <option value="30d">Joined last 30 days</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
          <option value="createdAt">Newest</option>
          <option value="lastActiveAt">Recently active</option>
          <option value="name">Name</option>
          <option value="listings">Listings</option>
          <option value="posts">Posts</option>
          <option value="rentals">Rentals</option>
        </select>
        <button className="outline-button" onClick={exportUsers}>
          Export CSV
        </button>
      </Toolbar>

      <Panel title="Accounts" kicker={`${users.length.toLocaleString()} shown`}>
        {users.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>@username</th>
                <th>School email</th>
                <th>Campus</th>
                <th>Signup</th>
                <th>Last active</th>
                <th>Listings</th>
                <th>Posts</th>
                <th>Rentals</th>
                <th>Status</th>
                <th>Email confirmed</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.uid} className="clickable-row" onClick={() => onSelectUser(user.uid)}>
                  <td>{user.displayName}</td>
                  <td>@{user.username}</td>
                  <td>{user.campusEmail ?? 'Not recorded'}</td>
                  <td>{campusName(data.campuses, user.campusId)}</td>
                  <td>{formatShortDate(user.createdAt)}</td>
                  <td>{formatShortDate(user.lastActiveAt)}</td>
                  <td>{user.stats.listingCount}</td>
                  <td>{user.stats.postCount}</td>
                  <td>{user.stats.rentalsAsLender + user.stats.rentalsAsRenter}</td>
                  <td>
                    <Pill tone={user.status === 'active' ? 'good' : 'warn'}>{user.status}</Pill>
                  </td>
                  <td>{user.verificationMethod === 'email_confirmed' ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No users match" body="Try clearing a filter or running the seed script." />
        )}
      </Panel>
    </>
  );
}

function UserDetailPage({
  user,
  data,
  onBack,
}: {
  user: User;
  data: AdminData;
  onBack: () => void;
}) {
  const listings = data.listings.filter((listing) => listing.ownerUid === user.uid);
  const posts = data.posts.filter((post) => post.authorUid === user.uid);
  const events = data.events
    .filter((event) => event.uid === user.uid)
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
    .slice(0, 20);

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
        <MetricCard label="Listings" value={listings.length} detail="Closet items" />
        <MetricCard label="Posts" value={posts.length} detail="Looks shared" />
        <MetricCard label="As lender" value={user.stats.rentalsAsLender} detail="Completed rentals" />
        <MetricCard label="As renter" value={user.stats.rentalsAsRenter} detail="Completed rentals" />
      </section>

      <section className="two-column">
        <Panel title="Closet" kicker={`${listings.length} items`}>
          <ThumbGrid
            items={listings.map((listing) => ({
              id: listing.id,
              title: listing.name,
              subtitle: `${CATEGORY_LABELS[listing.category]} · ${listing.status}`,
              imageUrl: listing.coverUrl,
            }))}
          />
        </Panel>
        <Panel title="Posts" kicker={`${posts.length} looks`}>
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

function RentalsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const bookings = data.bookings
    .filter((booking) => matchesCampus(booking, campusId))
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));

  return (
    <Panel title="All Bookings" kicker={`${bookings.length} total`}>
      {bookings.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Dates</th>
              <th>Listing</th>
              <th>Lender</th>
              <th>Renter</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td>
                  <Pill tone={booking.status === 'completed' ? 'good' : 'neutral'}>
                    {BOOKING_STATUS_LABELS[booking.status]}
                  </Pill>
                </td>
                <td>{booking.startDate && booking.endDate ? `${booking.startDate} to ${booking.endDate}` : 'Purchase'}</td>
                <td>{booking.listing.name}</td>
                <td>{booking.lender.displayName}</td>
                <td>{booking.renter.displayName}</td>
                <td>{formatMoney(booking.amounts.renterTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No bookings yet" body="Rental requests will appear here when Phase 4 data exists." />
      )}
    </Panel>
  );
}

function ListingsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const [query, setQuery] = useState('');
  const [occasion, setOccasion] = useState('all');
  const [status, setStatus] = useState('all');

  const listings = data.listings
    .filter((listing) => matchesCampus(listing, campusId))
    .filter((listing) => status === 'all' || listing.status === status)
    .filter((listing) => occasion === 'all' || listing.occasions.includes(occasion as Occasion))
    .filter((listing) => {
      const text = `${listing.name} ${listing.brand ?? ''} ${listing.owner.displayName}`.toLowerCase();
      return text.includes(query.toLowerCase().trim());
    });

  return (
    <>
      <Toolbar>
        <input
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search listings"
        />
        <select value={occasion} onChange={(event) => setOccasion(event.target.value)}>
          <option value="all">All occasions</option>
          {OCCASIONS.map((item) => (
            <option key={item} value={item}>
              {OCCASION_LABELS[item]}
            </option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          {LISTING_STATUSES.map((item) => (
            <option key={item} value={item}>
              {humanize(item)}
            </option>
          ))}
        </select>
      </Toolbar>
      <Panel title="Listings" kicker={`${listings.length} shown`}>
        <ModerationGrid
          emptyTitle="No listings match"
          items={listings.map((listing) => ({
            id: listing.id,
            imageUrl: listing.coverUrl,
            title: listing.name,
            subtitle: `${listing.owner.displayName} · ${CATEGORY_LABELS[listing.category]}`,
            status: listing.status,
            meta: `${formatMoney(listing.pricing.threeDayCents)} / 3 days · ${listing.stats.viewCount} views`,
            actionLabel: 'Hide listing',
          }))}
        />
      </Panel>
    </>
  );
}

function PostsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const posts = data.posts.filter((post) => matchesCampus(post, campusId));

  return (
    <Panel title="Posts" kicker={`${posts.length} shown`}>
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

function ReportsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const reports = data.reports.filter((report) => matchesCampus(report, campusId));
  return (
    <Panel title="Reports Queue" kicker={`${reports.length} reports`}>
      {reports.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Target</th>
              <th>Reason</th>
              <th>Details</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>{report.status}</td>
                <td>{report.targetType}</td>
                <td>{humanize(report.reason)}</td>
                <td>{report.details}</td>
                <td>{formatShortDate(report.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No reports yet" body="Flagged users, listings, posts, bookings, and messages will queue here." />
      )}
    </Panel>
  );
}

function ClaimsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const claims = data.damageClaims.filter((claim) => matchesCampus(claim, campusId));
  return (
    <Panel title="Damage Claims" kicker={`${claims.length} claims`}>
      {claims.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Type</th>
              <th>Requested</th>
              <th>Description</th>
              <th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id}>
                <td>{humanize(claim.status)}</td>
                <td>{humanize(claim.type)}</td>
                <td>{formatMoney(claim.requestedCents)}</td>
                <td>{claim.description}</td>
                <td>{formatShortDate(claim.claimWindowEndsAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No damage claims" body="Claims from rental returns will appear here in a later phase." />
      )}
    </Panel>
  );
}

function CampusesPage({ campuses }: { campuses: Campus[] }) {
  return (
    <section className="card-grid">
      {campuses.map((campus) => (
        <article key={campus.id} className="panel">
          <p className="label">{campus.isLive ? 'Live campus' : 'Not live'}</p>
          <h2>{campus.name}</h2>
          <p className="muted">{campus.emailDomains.join(' · ')}</p>
          <div className="campus-stats">
            <MiniStat label="Users" value={campus.stats.userCount} />
            <MiniStat label="Listings" value={campus.stats.listingCount} />
            <MiniStat label="Posts" value={campus.stats.postCount} />
            <MiniStat label="Bookings" value={campus.stats.bookingCount} />
          </div>
        </article>
      ))}
      {campuses.length === 0 ? (
        <EmptyState title="No campuses yet" body="Run the seed script to add the University of South Carolina." />
      ) : null}
    </section>
  );
}

function FoundingClosetsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const founders = data.users
    .filter((user) => user.isFoundingCloset)
    .filter((user) => matchesCampus(user, campusId))
    .sort((a, b) => b.stats.listingCount - a.stats.listingCount);

  return (
    <Panel title="Founding Closets" kicker={`${founders.length} accounts`}>
      {founders.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>@username</th>
              <th>Campus</th>
              <th>Items listed</th>
              <th>Posts</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {founders.map((user) => (
              <tr key={user.uid}>
                <td>{user.displayName}</td>
                <td>@{user.username}</td>
                <td>{campusName(data.campuses, user.campusId)}</td>
                <td>{user.stats.listingCount}</td>
                <td>{user.stats.postCount}</td>
                <td>{formatShortDate(user.lastActiveAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No founding closets yet" body="Accounts marked as founding closets will be tracked here." />
      )}
    </Panel>
  );
}

function ActivityLogPage({ data }: { data: AdminData }) {
  const actions = [...data.adminActions].sort(
    (a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0),
  );

  return (
    <Panel title="Activity Log" kicker={`${actions.length} admin actions`}>
      {actions.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Target</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action.id}>
                <td>{formatDate(action.createdAt)}</td>
                <td>{action.adminUid}</td>
                <td>{action.action}</td>
                <td>
                  {action.targetType} · {action.targetId}
                </td>
                <td>{action.notes ?? 'No notes'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          title="No admin actions yet"
          body="Suspend, hide, and resolve actions need backend support before this audit log fills."
        />
      )}
    </Panel>
  );
}

function makeOverviewMetrics(data: AdminData, window: ReturnType<typeof getDateWindow>) {
  const usersInWindow = data.users.filter((user) => isInWindow(user.createdAt, window));
  const usersPrevious = data.users.filter((user) => isInPreviousWindow(user.createdAt, window));
  const listingsInWindow = data.listings.filter((listing) => isInWindow(listing.createdAt, window));
  const listingsPrevious = data.listings.filter((listing) => isInPreviousWindow(listing.createdAt, window));
  const postsInWindow = data.posts.filter((post) => isInWindow(post.createdAt, window));
  const postsPrevious = data.posts.filter((post) => isInPreviousWindow(post.createdAt, window));
  const requests = data.bookings.filter(
    (booking) => booking.timeline.requestedAt && isInWindow(booking.timeline.requestedAt, window),
  );
  const previousRequests = data.bookings.filter(
    (booking) =>
      booking.timeline.requestedAt && isInPreviousWindow(booking.timeline.requestedAt, window),
  );
  const completed = data.bookings.filter(
    (booking) => booking.status === 'completed' && isInWindow(booking.timeline.completedAt, window),
  );
  const previousCompleted = data.bookings.filter(
    (booking) =>
      booking.status === 'completed' && isInPreviousWindow(booking.timeline.completedAt, window),
  );
  const activeDay = uniqueRecentUsers(data.events, 1);
  const activeWeek = uniqueRecentUsers(data.events, 7);

  return {
    headlines: [
      {
        label: 'Total Users',
        value: data.users.length,
        detail: changeLabel(usersInWindow.length, usersPrevious.length, window.key === 'all'),
      },
      {
        label: 'New Signups',
        value: usersInWindow.length,
        detail: changeLabel(usersInWindow.length, usersPrevious.length, window.key === 'all'),
      },
      { label: 'Daily Active', value: activeDay, detail: 'Unique users in last 24 hours' },
      { label: 'Weekly Active', value: activeWeek, detail: 'Unique users in last 7 days' },
      {
        label: 'Listings',
        value: data.listings.length,
        detail: changeLabel(listingsInWindow.length, listingsPrevious.length, window.key === 'all'),
      },
      {
        label: 'Posts',
        value: data.posts.length,
        detail: changeLabel(postsInWindow.length, postsPrevious.length, window.key === 'all'),
      },
      {
        label: 'Rental Requests',
        value: requests.length,
        detail: changeLabel(requests.length, previousRequests.length, window.key === 'all'),
      },
      {
        label: 'Completed Rentals',
        value: completed.length,
        detail: changeLabel(completed.length, previousCompleted.length, window.key === 'all'),
      },
      { label: 'Views', value: eventCount(data.events, ['post_view', 'listing_view'], window), detail: 'Post + listing views' },
      { label: 'Likes', value: eventCount(data.events, ['post_like'], window), detail: 'Post likes' },
      { label: 'Saves', value: eventCount(data.events, ['post_save', 'listing_save'], window), detail: 'Looks + listings saved' },
      { label: 'Follows', value: eventCount(data.events, ['follow'], window), detail: 'New follows' },
      { label: 'Tagged-Item Taps', value: eventCount(data.events, ['tagged_item_tap'], window), detail: 'Social to marketplace' },
    ],
    signupsChart: seriesByDay(data.users.map((user) => user.createdAt), window),
    activeUsersChart: activeSeries(data.events, window),
    listingsChart: seriesByDay(data.listings.map((listing) => listing.createdAt), window),
    postsChart: seriesByDay(data.posts.map((post) => post.createdAt), window),
  };
}

function makeFunnel(data: AdminData, window: ReturnType<typeof getDateWindow>) {
  const users = data.users.filter((user) => isInWindow(user.createdAt, window));
  const userIds = new Set(users.map((user) => user.uid));
  const listed = new Set(data.listings.filter((listing) => userIds.has(listing.ownerUid)).map((item) => item.ownerUid));
  const posted = new Set(data.posts.filter((post) => userIds.has(post.authorUid)).map((item) => item.authorUid));
  const requested = new Set(data.bookings.filter((booking) => userIds.has(booking.renterUid)).map((item) => item.renterUid));
  const completed = new Set(
    data.bookings
      .filter((booking) => booking.status === 'completed')
      .flatMap((booking) => [booking.lenderUid, booking.renterUid])
      .filter((uid) => userIds.has(uid)),
  );

  return [
    { label: 'Signed up', value: users.length },
    { label: 'Completed profile', value: users.filter((user) => user.username && user.displayName).length },
    { label: 'Listed an item', value: listed.size },
    { label: 'Posted', value: posted.size },
    { label: 'Requested a rental', value: requested.size },
    { label: 'Completed a rental', value: completed.size },
  ];
}

function makeRetention(users: User[], events: AppEvent[]) {
  const cohorts = new Map<string, User[]>();
  users.forEach((user) => {
    const key = weekKey(user.createdAt);
    cohorts.set(key, [...(cohorts.get(key) ?? []), user]);
  });

  return [...cohorts.entries()]
    .filter(([week]) => week !== 'Unknown')
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 8)
    .map(([week, cohort]) => {
      const start = new Date(`${week}T00:00:00`);
      const nextWeekStart = new Date(start);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      const laterStart = new Date(start);
      laterStart.setDate(laterStart.getDate() + 14);
      const cohortIds = new Set(cohort.map((user) => user.uid));
      const returningEvents = events.filter((event) => event.uid && cohortIds.has(event.uid));
      return {
        week,
        signups: cohort.length,
        nextWeek: uniqueAfter(returningEvents, nextWeekStart, laterStart),
        later: uniqueAfter(returningEvents, laterStart, null),
      };
    });
}

function scopeData(data: AdminData, campusId: string): AdminData {
  return {
    users: data.users.filter((item) => matchesCampus(item, campusId)),
    campuses: data.campuses.filter((item) => campusId === 'all' || item.id === campusId),
    listings: data.listings.filter((item) => matchesCampus(item, campusId)),
    posts: data.posts.filter((item) => matchesCampus(item, campusId)),
    bookings: data.bookings.filter((item) => matchesCampus(item, campusId)),
    reports: data.reports.filter((item) => matchesCampus(item, campusId)),
    damageClaims: data.damageClaims.filter((item) => matchesCampus(item, campusId)),
    adminActions: data.adminActions,
    events: data.events.filter((item) => matchesCampus(item, campusId)),
  };
}

function uniqueRecentUsers(events: AppEvent[], days: number): number {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return new Set(
    events
      .filter((event) => event.uid && (toDate(event.createdAt)?.getTime() ?? 0) >= since.getTime())
      .map((event) => event.uid),
  ).size;
}

function eventCount(events: AppEvent[], types: AppEvent['type'][], window: ReturnType<typeof getDateWindow>) {
  return events.filter((event) => types.includes(event.type) && isInWindow(event.createdAt, window)).length;
}

function seriesByDay(values: Array<Parameters<typeof dayKey>[0]>, window: ReturnType<typeof getDateWindow>) {
  const counts = new Map<string, number>();
  values.filter((value) => isInWindow(value, window)).forEach((value) => addCount(counts, dayKey(value)));
  return mapToPoints(counts);
}

function activeSeries(events: AppEvent[], window: ReturnType<typeof getDateWindow>) {
  const usersByDay = new Map<string, Set<string>>();
  events
    .filter((event) => event.uid && isInWindow(event.createdAt, window))
    .forEach((event) => {
      const key = dayKey(event.createdAt);
      usersByDay.set(key, new Set([...(usersByDay.get(key) ?? []), event.uid ?? '']));
    });
  return [...usersByDay.entries()]
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .slice(-14)
    .map(([label, set]) => ({ label: label.slice(5), value: set.size }));
}

function mapToPoints(counts: Map<string, number>) {
  return [...counts.entries()]
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .slice(-14)
    .map(([label, value]) => ({ label: label.slice(5), value }));
}

function addCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function uniqueAfter(events: AppEvent[], start: Date, end: Date | null) {
  return new Set(
    events
      .filter((event) => {
        const date = toDate(event.createdAt);
        if (!date) return false;
        return date >= start && (!end || date < end);
      })
      .map((event) => event.uid),
  ).size;
}

function sortUsers(a: User, b: User, sort: SortKey) {
  if (sort === 'name') return a.displayName.localeCompare(b.displayName);
  if (sort === 'listings') return b.stats.listingCount - a.stats.listingCount;
  if (sort === 'posts') return b.stats.postCount - a.stats.postCount;
  if (sort === 'rentals') {
    return (
      b.stats.rentalsAsLender +
      b.stats.rentalsAsRenter -
      (a.stats.rentalsAsLender + a.stats.rentalsAsRenter)
    );
  }
  return (toDate(b[sort])?.getTime() ?? 0) - (toDate(a[sort])?.getTime() ?? 0);
}

function campusName(campuses: Campus[], campusId: string) {
  return campuses.find((campus) => campus.id === campusId)?.name ?? campusId;
}

function Loading() {
  return <main className="content"><p className="muted">Loading admin data...</p></main>;
}

function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

function Panel({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          {kicker ? <p className="label">{kicker}</p> : null}
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="metric-card">
      <p className="label">{label}</p>
      <strong>{value.toLocaleString()}</strong>
      <span>{detail}</span>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value.toLocaleString()}</strong>
      <span className="label">{label}</span>
    </div>
  );
}

function ChartCard({ title, points }: { title: string; points: Array<{ label: string; value: number }> }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <Panel title={title}>
      {points.length > 0 ? (
        <div className="bar-chart">
          {points.map((point) => (
            <div key={`${title}-${point.label}`} className="bar-column">
              <span>{point.value}</span>
              <div style={{ height: `${Math.max(8, (point.value / max) * 120)}px` }} />
              <small>{point.label}</small>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No data yet" body="This chart will fill as events arrive." />
      )}
    </Panel>
  );
}

function Funnel({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(rows[0]?.value ?? 0, 1);
  return (
    <div className="funnel">
      {rows.map((row) => (
        <div key={row.label} className="funnel-row">
          <span>{row.label}</span>
          <div>
            <div style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
          </div>
          <strong>{row.value.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  );
}

function Timeline({ events }: { events: AppEvent[] }) {
  if (events.length === 0) {
    return <EmptyState title="No activity yet" body="This user's app events will appear here." />;
  }
  return (
    <ol className="timeline">
      {events.map((event) => (
        <li key={event.id}>
          <span>{formatShortDate(event.createdAt)}</span>
          <strong>{humanize(event.type)}</strong>
          <p>{event.surface} · {event.targetType ?? 'screen'}</p>
        </li>
      ))}
    </ol>
  );
}

function ThumbGrid({
  items,
}: {
  items: Array<{ id: string; imageUrl: string | null; title: string; subtitle: string }>;
}) {
  if (items.length === 0) return <EmptyState title="Nothing here yet" body="Seeded or real content will appear here." />;
  return (
    <div className="thumb-grid">
      {items.map((item) => (
        <article key={item.id}>
          <ImageBlock imageUrl={item.imageUrl} alt={item.title} />
          <strong>{item.title}</strong>
          <span>{item.subtitle}</span>
        </article>
      ))}
    </div>
  );
}

function ModerationGrid({
  items,
  emptyTitle,
}: {
  emptyTitle: string;
  items: Array<{
    id: string;
    imageUrl: string | null;
    title: string;
    subtitle: string;
    status: string;
    meta: string;
    actionLabel: string;
  }>;
}) {
  if (items.length === 0) return <EmptyState title={emptyTitle} body="Try clearing filters or running the seed script." />;
  return (
    <div className="moderation-list">
      {items.map((item) => (
        <article key={item.id}>
          <ImageBlock imageUrl={item.imageUrl} alt={item.title} />
          <div>
            <p className="label">{item.subtitle}</p>
            <h3>{item.title}</h3>
            <p className="muted">{item.meta}</p>
          </div>
          <Pill tone={item.status === 'active' ? 'good' : 'neutral'}>{item.status}</Pill>
          <button className="outline-button" disabled title="Needs a Cloud Function">
            {item.actionLabel}
          </button>
        </article>
      ))}
    </div>
  );
}

function ImageBlock({ imageUrl, alt }: { imageUrl: string | null; alt: string }) {
  return imageUrl ? (
    <img src={imageUrl} alt={alt} className="thumb" />
  ) : (
    <div className="thumb placeholder" aria-label={alt} />
  );
}

function Avatar({ user }: { user: User }) {
  return user.photoUrl ? (
    <img src={user.photoUrl} alt={user.displayName} className="avatar" />
  ) : (
    <div className="avatar placeholder">{user.displayName.slice(0, 1)}</div>
  );
}

function CampusSelect({
  campuses,
  value,
  onChange,
}: {
  campuses: Campus[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="all">All campuses</option>
      {campuses.map((campus) => (
        <option key={campus.id} value={campus.id}>
          {campus.name}
        </option>
      ))}
    </select>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented">
      {options.map(([key, label]) => (
        <button key={key} className={key === value ? 'active' : ''} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone: 'good' | 'warn' | 'neutral' }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <p className="label">{title}</p>
      <p>{body}</p>
    </div>
  );
}
