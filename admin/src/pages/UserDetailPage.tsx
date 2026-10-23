import { useEffect, useState } from 'react';
import {
  COLLECTIONS,
  CATEGORY_LABELS,
  type AppEvent,
  type User,
  type UserPrivate,
} from '@loane/shared';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AdminData } from '../data/adminData';
import { toDate } from '../data/adminData';
import { Avatar, MetricCard, Panel } from '../components/ui';
import { ActionDialog } from '../components/ActionDialog';
import {
  addAdminNote,
  adminErrorMessage,
  grantTryOns,
  adminExportUserData,
  adminDeleteAccount,
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

type Dialog =
  'suspend' | 'unsuspend' | 'note' | 'grantTryOns' | 'exportData' | 'deleteAccount' | null;

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
  /** How many extra try-ons this grant gives. Five is another full free run. */
  const [grantCount, setGrantCount] = useState(5);
  const [error, setError] = useState<string | null>(null);
  /** Her @username, typed again before an account is erased. */
  const [confirmName, setConfirmName] = useState('');

  const suspended = user.status === 'suspended';
  const deleted = user.status === 'deactivated';
  // Two rules the panel should not even offer, never mind enforce.
  const protectedAccount = user.role === 'admin';

  const run = async (reason: string) => {
    setBusy(true);
    setError(null);
    try {
      if (dialog === 'suspend') await suspendUser({ uid: user.uid, reason });
      if (dialog === 'unsuspend') await unsuspendUser({ uid: user.uid, reason });
      if (dialog === 'note') await addAdminNote({ uid: user.uid, note: reason });
      if (dialog === 'grantTryOns') await grantTryOns({ uid: user.uid, count: grantCount, reason });
      if (dialog === 'exportData') {
        const { data: exported } = await adminExportUserData({ uid: user.uid, reason });
        downloadJson(
          `loane-data-${user.username}-${new Date().toISOString().slice(0, 10)}.json`,
          exported,
        );
      }
      if (dialog === 'deleteAccount') {
        await adminDeleteAccount({ uid: user.uid, reason, confirmUsername: confirmName });
      }
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
            This is an admin account. Admins cannot be suspended from here — remove the admin claim
            first.
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
          {/* For a privacy request: everything we hold about her, as one
              file. Audited. Deleting is her own "Delete my account". */}
          <button onClick={() => setDialog('exportData')}>Export her data</button>
          {/* For a privacy request she can't do herself. Same steps as her
              own "Delete my account"; she must be typed in by @username. */}
          <button
            disabled={protectedAccount || deleted}
            title={deleted ? 'This account is already deleted.' : undefined}
            onClick={() => {
              setConfirmName('');
              setDialog('deleteAccount');
            }}
          >
            Delete this account
          </button>
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
          {/* The free allowance is five for life. This is how Ella and
              our testers are not the first people locked out of the
              thing they are meant to be judging. */}
          <button className="outline-button" onClick={() => setDialog('grantTryOns')}>
            Give free try-ons
          </button>
        </div>
      </section>

      <section className="metric-grid four">
        <MetricCard label="Listings" value={listings.length} detail="Closet items loaded" />
        <MetricCard label="Posts" value={posts.length} detail="Looks shared" />
        <MetricCard
          label="As lender"
          value={user.stats.rentalsAsLender}
          detail="Completed rentals"
        />
        <MetricCard
          label="As renter"
          value={user.stats.rentalsAsRenter}
          detail="Completed rentals"
        />
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
            : dialog === 'grantTryOns'
              ? `Give @${user.username} free try-ons?`
              : dialog === 'exportData'
                ? `Export everything about @${user.username}?`
                : dialog === 'deleteAccount'
                  ? `Delete @${user.username}'s account?`
                  : dialog === 'unsuspend'
                    ? `Lift the suspension on @${user.username}?`
                    : 'Add a private note'
        }
        description={
          dialog === 'suspend'
            ? 'She can still browse Loane, but cannot post, list, rent or message. She is told why and given an address to appeal to.'
            : dialog === 'exportData'
              ? 'Downloads one file with her profile, pieces, looks, rentals, chats and activity. Only for a privacy request — say which one.'
              : dialog === 'deleteAccount'
                ? 'Cannot be undone. Exactly what her own "Delete my account" does: her looks, pieces, comments, likes, follows, photos and login go; past rentals, reviews she wrote and chats stay under "Deleted account". Refused while she has a rental going. Export her data first if she asked for a copy.'
                : dialog === 'grantTryOns'
                  ? `Adds ${grantCount} try-ons on top of her free five. Each one costs us about $0.08 to generate, unless it comes from the cache.`
                  : dialog === 'unsuspend'
                    ? 'She gets full access back and is told so.'
                    : 'Only admins can read this. She never sees it.'
        }
        confirmLabel={
          dialog === 'suspend'
            ? 'Suspend'
            : dialog === 'unsuspend'
              ? 'Lift it'
              : dialog === 'grantTryOns'
                ? `Give ${grantCount}`
                : dialog === 'exportData'
                  ? 'Download'
                  : dialog === 'deleteAccount'
                    ? 'Delete for good'
                    : 'Save note'
        }
        danger={error ?? undefined}
        busy={busy}
        onConfirm={(reason) => void run(reason)}
        onClose={() => {
          setDialog(null);
          setError(null);
        }}
      >
        {dialog === 'grantTryOns' ? (
          <label className="field">
            <span>How many</span>
            <input
              type="number"
              min={1}
              max={100}
              value={grantCount}
              onChange={(e) => setGrantCount(Number(e.target.value))}
            />
          </label>
        ) : dialog === 'deleteAccount' ? (
          <label className="field">
            <span>Type @{user.username} to confirm</span>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
            />
          </label>
        ) : undefined}
      </ActionDialog>
    </>
  );
}

/** Saves a JSON object as a file, from the browser. */
function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function recentUserEvents(events: AppEvent[], uid: string) {
  return events
    .filter((event) => event.uid === uid)
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
    .slice(0, 20);
}
