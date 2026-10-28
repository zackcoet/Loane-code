import { useCallback, useEffect, useState } from 'react';
import {
  AUTO_FILTER_REPORTER_UID,
  BOOKING_STATUS_LABELS,
  COLLECTIONS,
  DISPUTE_OUTCOME_LABELS,
  CATEGORY_LABELS,
  adminActionLabel,
  adminActionsAboutUser,
  bookingsForUser,
  grantBlockedReason,
  isCountedListing,
  isCountedPost,
  personLabelWithCopy,
  reportPersonLabel,
  reportsAboutUser,
  type AdminAction,
  type AdminNote,
  type AppEvent,
  type DisputeOutcome,
  type User,
  type UserPrivate,
} from '@loane/shared';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AdminData } from '../data/adminData';
import { formatMoney, formatShortDate, humanize, toDate } from '../data/adminData';
import { PersonLink } from '../components/PersonLink';
import { Avatar, EmptyState, MetricCard, Panel, Pill } from '../components/ui';
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
  /** Opens another girl's page (the other side of a rental). */
  onOpenUser: (uid: string) => void;
}

type Dialog =
  'suspend' | 'unsuspend' | 'note' | 'grantTryOns' | 'exportData' | 'deleteAccount' | null;

export function UserDetailPage({ user, data, onBack, onOpenUser }: Props) {
  const listings = data.listings.filter((listing) => listing.ownerUid === user.uid);
  const posts = data.posts.filter((post) => post.authorUid === user.uid);
  const events = recentUserEvents(data.events, user.uid);
  // Her rentals and sales on both sides, open disputes first, from the
  // bookings the dashboard already loaded (newest 250 across campus).
  const rentals = bookingsForUser(
    [...data.bookings].sort(
      (a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0),
    ),
    user.uid,
  );
  const openDisputes = rentals.filter((row) => row.booking.status === 'disputed').length;

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

  const reports = reportsAboutUser(data.reports, user.uid);
  // Matched by account id, so messages she sent before a rename still show.
  const supportRequests = data.supportRequests
    .filter((request) => request.requesterUid === user.uid)
    .sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved'));
  const openReports = reports.filter(
    (report) => report.status === 'open' || report.status === 'reviewing',
  ).length;

  // Notes used to be write-only: "Add a private note" saved one, and the
  // panel that should list them sat disabled saying "Backend needed".
  // Read fresh for the one student on screen, newest first.
  const [notes, setNotes] = useState<AdminNote[] | null>(null);
  const [notesError, setNotesError] = useState(false);
  const loadNotes = useCallback(() => {
    let live = true;
    setNotesError(false);
    void getDocs(
      query(
        collection(db, COLLECTIONS.users, user.uid, 'adminNotes'),
        orderBy('createdAt', 'desc'),
        limit(NOTES_SHOWN),
      ),
    )
      .then((snap) => {
        if (live) setNotes(snap.docs.map((d) => ({ ...(d.data() as AdminNote), id: d.id })));
      })
      .catch(() => {
        if (live) setNotesError(true);
      });
    return () => {
      live = false;
    };
  }, [user.uid]);
  useEffect(() => {
    setNotes(null);
    return loadNotes();
  }, [loadNotes]);

  // What admins have done to her account: suspensions, notes, exports,
  // try-on grants. The Activity Log only loads the latest 100 actions
  // across everyone, so an old suspension would fall off it; this reads
  // hers fresh. One equality filter, so no new index: her account id is a
  // row's targetId only when the action was on her account (the type is
  // checked again below). Unordered, so the cap is generous and the rows
  // are sorted newest first here.
  const [actions, setActions] = useState<AdminAction[] | null>(null);
  const [actionsError, setActionsError] = useState(false);
  const loadActions = useCallback(() => {
    let live = true;
    setActionsError(false);
    void getDocs(
      query(
        collection(db, COLLECTIONS.adminActions),
        where('targetId', '==', user.uid),
        limit(ACTIONS_SHOWN),
      ),
    )
      .then((snap) => {
        if (!live) return;
        const rows = snap.docs.map((d) => ({ ...(d.data() as AdminAction), id: d.id }));
        setActions(
          adminActionsAboutUser(rows, user.uid, (row) => toDate(row.createdAt)?.getTime() ?? 0),
        );
      })
      .catch(() => {
        if (live) setActionsError(true);
      });
    return () => {
      live = false;
    };
  }, [user.uid]);
  useEffect(() => {
    setActions(null);
    return loadActions();
  }, [loadActions]);

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
      if (dialog === 'note') {
        await addAdminNote({ uid: user.uid, note: reason });
        loadNotes();
      }
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
      // Every one of these writes an audit row; show it straight away.
      loadActions();
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
      <Panel
        title="Moderation"
        // A deleted account used to read "Active" here.
        kicker={deleted ? 'Deleted account' : suspended ? 'Suspended' : 'Active'}
      >
        {deleted ? (
          <p className="cell-note">
            She deleted this account (or it was deleted for her). Her pieces and looks are down and
            can't be put back; her rentals, reviews and reports stay as records.
          </p>
        ) : null}
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
            <button disabled={protectedAccount || deleted} onClick={() => setDialog('suspend')}>
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
          {/* Same dialogs as the Moderation panel's buttons. This one sat
              disabled with "Needs a Cloud Function" long after the
              functions existed. */}
          <button
            className="outline-button"
            disabled={deleted || (!suspended && protectedAccount)}
            onClick={() => setDialog(suspended ? 'unsuspend' : 'suspend')}
          >
            {suspended ? 'Unsuspend' : 'Suspend'}
          </button>
          {/* The free allowance is five for life. This is how Ella and
              our testers are not the first people locked out of the
              thing they are meant to be judging. */}
          <button
            className="outline-button"
            disabled={Boolean(grantBlockedReason(user.status))}
            title={grantBlockedReason(user.status) ?? undefined}
            onClick={() => setDialog('grantTryOns')}
          >
            Give free try-ons
          </button>
        </div>
      </section>

      <section className="metric-grid four">
        {/* On Loane now, the same rule as the Overview (run 62): removed
            and taken-down ones are still listed below, not counted here. */}
        <MetricCard
          label="Listings"
          value={listings.filter(isCountedListing).length}
          detail="On her closet now"
        />
        <MetricCard
          label="Posts"
          value={posts.filter(isCountedPost).length}
          detail="Looks up now"
        />
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
        <Panel title="Private Notes" kicker="Only admins can read these">
          {notesError ? (
            <p className="cell-note">
              Couldn't load her notes.{' '}
              <button className="text-button" onClick={() => loadNotes()}>
                Try again
              </button>
            </p>
          ) : notes === null ? (
            <p className="muted">Loading notes...</p>
          ) : notes.length === 0 ? (
            <EmptyState
              title="No notes yet"
              body="Write down anything the next admin should know, like a warning you gave her."
            />
          ) : (
            <ul className="note-list">
              {notes.map((note) => (
                <li key={note.id}>
                  <p>{note.note}</p>
                  <p className="cell-note">
                    {formatShortDate(note.createdAt)} · {note.adminEmail ?? 'An admin'}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="row-actions" style={{ marginTop: 12 }}>
            <button onClick={() => setDialog('note')}>Add a private note</button>
          </div>
        </Panel>
      </section>

      <Panel
        title="Her Rentals And Sales"
        kicker={`${openDisputes} disputed · ${rentals.length} loaded`}
      >
        {rentals.length === 0 ? (
          <EmptyState
            title="No rentals yet"
            body="Pieces she lends, sells, rents or buys show here, with who was on the other side."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>She was</th>
                <th>Piece</th>
                <th>With</th>
                <th>Dates</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {rentals.map(({ booking, side }) => {
                const otherUid = side === 'lender' ? booking.renterUid : booking.lenderUid;
                const otherCopy = side === 'lender' ? booking.renter : booking.lender;
                const sale = booking.kind === 'purchase';
                const outcome = booking.disputeResolution?.outcome as DisputeOutcome | undefined;
                return (
                  <tr key={booking.id}>
                    <td>
                      <Pill
                        tone={
                          booking.status === 'disputed'
                            ? 'bad'
                            : booking.status === 'completed'
                              ? 'good'
                              : 'neutral'
                        }
                      >
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </Pill>
                      {outcome && DISPUTE_OUTCOME_LABELS[outcome] ? (
                        <div className="cell-note">Dispute: {DISPUTE_OUTCOME_LABELS[outcome]}</div>
                      ) : null}
                    </td>
                    <td>
                      {side === 'lender' ? (sale ? 'Seller' : 'Lender') : sale ? 'Buyer' : 'Renter'}
                    </td>
                    <td>{booking.listing.name}</td>
                    <td>
                      <PersonLink
                        person={personLabelWithCopy(otherUid, data.users, otherCopy)}
                        onOpen={onOpenUser}
                      />
                    </td>
                    <td>
                      {booking.startDate && booking.endDate
                        ? `${booking.startDate} to ${booking.endDate}`
                        : 'Purchase'}
                    </td>
                    <td>{formatMoney(booking.amounts.renterTotalCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="cell-note">Decide a disputed return from Rentals.</p>
      </Panel>

      <Panel
        title="Reports About Her"
        kicker={`${openReports} need attention · ${reports.length} total`}
      >
        {reports.length === 0 ? (
          <EmptyState
            title="No reports about her"
            body="Anything students report about her posts, pieces, comments, messages or profile shows here."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>What</th>
                <th>Reason</th>
                <th>From</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>
                    <Pill tone={report.status === 'open' ? 'bad' : 'neutral'}>{report.status}</Pill>
                  </td>
                  <td>
                    {report.targetType}
                    {report.snapshot ? <div className="cell-note">“{report.snapshot}”</div> : null}
                  </td>
                  <td>{humanize(report.reason)}</td>
                  <td>
                    {
                      reportPersonLabel(report.reporterUid, data.users, AUTO_FILTER_REPORTER_UID)
                        .label
                    }
                  </td>
                  <td>{formatShortDate(report.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="cell-note">
          Act on a report from Reports, where closing it and acting happen together.
        </p>
      </Panel>

      <Panel
        title="Her Contact Us Messages"
        kicker={`${supportRequests.filter((r) => r.status === 'open').length} open · ${supportRequests.length} total`}
      >
        {supportRequests.length === 0 ? (
          <EmptyState
            title="No messages from her"
            body="Anything she sends through Help → Contact us shows here."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Topic</th>
                <th>Message</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {supportRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Pill tone={request.status === 'open' ? 'bad' : 'good'}>{request.status}</Pill>
                  </td>
                  <td>{humanize(request.topic)}</td>
                  <td>{request.message}</td>
                  <td>{formatShortDate(request.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="cell-note">Resolve a message from Support.</p>
      </Panel>

      <Panel title="Admin Actions On Her Account" kicker="From the audit log">
        {actionsError ? (
          <p className="cell-note">
            Couldn't load the actions on her account.{' '}
            <button className="text-button" onClick={() => loadActions()}>
              Try again
            </button>
          </p>
        ) : actions === null ? (
          <p className="muted">Loading actions...</p>
        ) : actions.length === 0 ? (
          <EmptyState
            title="No admin actions on her account"
            body="Suspensions, notes, data exports and try-on grants on her account show here, with who did them and why."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Admin</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id}>
                  <td>{formatShortDate(action.createdAt)}</td>
                  <td>{adminActionLabel(action.action)}</td>
                  <td>
                    {action.adminEmail ?? reportPersonLabel(action.adminUid, data.users).label}
                  </td>
                  <td>{action.notes ?? 'No notes'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

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

/** Admin actions on her account shown; plenty for one student's history. */
const ACTIONS_SHOWN = 200;

/** Her newest private notes shown; plenty for one student's history. */
const NOTES_SHOWN = 50;

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
