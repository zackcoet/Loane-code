import { useEffect, useState } from 'react';
import { COLLECTIONS, CATEGORY_LABELS, type AppEvent, type User, type UserPrivate } from '@loane/shared';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AdminData } from '../data/adminData';
import { toDate } from '../data/adminData';
import { Avatar, MetricCard, Panel } from '../components/ui';
import { ActionDialog } from '../components/ActionDialog';
import {
  addAdminNote,
  adminErrorMessage,
  suspendUser,
  unsuspendUser,
} from '../data/adminActions';
import { ThumbGrid, Timeline } from '../components/media';
import { campusName } from './UsersPage';

interface Props {
  user: User;
  data: AdminData;
  onBack: () => void;
}

type Dialog = 'suspend' | 'unsuspend' | 'note' | null;

export function UserDetailPage({ user, data, onBack }: Props) {
  const listings = data.listings.filter((listing) => listing.ownerUid === user.uid);
  const posts = data.posts.filter((post) => post.authorUid === user.uid);
  const events = recentUserEvents(data.events, user.uid);

  // Her school email lives in her private document now, so it is one
  // read for the one student an admin is actually looking at, rather
  // than part of every list.
  const [privateDoc, setPrivateDoc] = useState<UserPrivate | null>(null);
  useEffect(() => {
    let live = true;
    setPrivateDoc(null);
    void getDoc(doc(db, COLLECTIONS.users, user.uid, 'private', 'settings'))
      .then((snap) => {
        if (live && snap.exists()) setPrivateDoc(snap.data() as UserPrivate);
      })
      .catch(() => {
        /* An admin who cannot read it sees "no school email recorded". */
      });
    return () => {
      live = false;
    };
  }, [user.uid]);

  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suspended = user.status === 'suspended';
  // Two rules the panel should not even offer, never mind enforce.
  const protectedAccount = user.role === 'admin';

  const run = async (reason: string) => {
    setBusy(true);
    setError(null);
    try {
      if (dialog === 'suspend') await suspendUser({ uid: user.uid, reason });
      if (dialog === 'unsuspend') await unsuspendUser({ uid: user.uid, reason });
      if (dialog === 'note') await addAdminNote({ uid: user.uid, note: reason });
      setDialog(null);
    } catch (err) {
      setError(adminErrorMessage(err, 'Could not do that.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="text-button back-button" onClick={onBack}>
        Back to users
      </button>
      <Panel title="Moderation" kicker={suspended ? 'Suspended' : 'Active'}>
        {suspended && user.suspendedReason ? (
          <p className="cell-note">Reason on file: {user.suspendedReason}</p>
        ) : null}
        {protectedAccount ? (
          <p className="cell-note">
            This is an admin account. Admins cannot be suspended from here — remove the admin
            claim first.
          </p>
        ) : null}
        <div className="row-actions" style={{ marginTop: 12 }}>
          {suspended ? (
            <button onClick={() => setDialog('unsuspend')}>Lift suspension</button>
          ) : (
            <button disabled={protectedAccount} onClick={() => setDialog('suspend')}>
              Suspend
            </button>
          )}
          <button onClick={() => setDialog('note')}>Add a private note</button>
        </div>
        {user.stats.cancellations > 0 ? (
          <p className="cell-note" style={{ marginTop: 12 }}>
            {user.stats.cancellations} cancelled{' '}
            {user.stats.cancellations === 1 ? 'rental' : 'rentals'}
            {user.stats.cancellations > 2 ? ' — worth a look' : ''}
          </p>
        ) : null}
      </Panel>

      <section className="profile-header">
        <Avatar user={user} />
        <div>
          <p className="label">{campusName(data.campuses, user.campusId)}</p>
          <h2>{user.displayName}</h2>
          <p className="muted">
            @{user.username} · {privateDoc?.campusEmail ?? 'No school email recorded'}
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

      <ActionDialog
        open={dialog !== null}
        title={
          dialog === 'suspend'
            ? `Suspend @${user.username}?`
            : dialog === 'unsuspend'
              ? `Lift the suspension on @${user.username}?`
              : 'Add a private note'
        }
        description={
          dialog === 'suspend'
            ? 'She can still browse Loane, but cannot post, list, rent or message. She is told why and given an address to appeal to.'
            : dialog === 'unsuspend'
              ? 'She gets full access back and is told so.'
              : 'Only admins can read this. She never sees it.'
        }
        confirmLabel={
          dialog === 'suspend' ? 'Suspend' : dialog === 'unsuspend' ? 'Lift it' : 'Save note'
        }
        danger={error ?? undefined}
        busy={busy}
        onConfirm={(reason) => void run(reason)}
        onClose={() => {
          setDialog(null);
          setError(null);
        }}
      />
    </>
  );
}

function recentUserEvents(events: AppEvent[], uid: string) {
  return events
    .filter((event) => event.uid === uid)
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
    .slice(0, 20);
}
