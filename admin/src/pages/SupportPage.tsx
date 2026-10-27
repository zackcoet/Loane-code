import { useState } from 'react';
import { personLabelWithCopy, type SupportRequest } from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { formatShortDate, humanize, matchesCampus } from '../data/adminData';
import { ActionDialog } from '../components/ActionDialog';
import { EmptyState, Panel, Pill } from '../components/ui';
import { PersonLink } from '../components/PersonLink';
import { adminErrorMessage, resolveSupportRequest } from '../data/adminActions';

export function SupportPage({
  data,
  campusId,
  onOpenUser,
}: {
  data: AdminData;
  campusId: string;
  /** Opens her page under Users. */
  onOpenUser: (uid: string) => void;
}) {
  const requests = [
    ...data.supportRequests.filter((request) => matchesCampus(request, campusId)),
  ].sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved'));
  const open = requests.filter((request) => request.status === 'open').length;

  const [resolving, setResolving] = useState<SupportRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (notes: string) => {
    if (!resolving) return;
    setBusy(true);
    setError(null);
    try {
      await resolveSupportRequest({ requestId: resolving.id, notes });
      setResolving(null);
    } catch (err) {
      setError(adminErrorMessage(err, 'Could not resolve that support request.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Support Inbox" kicker={`${open} open · ${requests.length} total`}>
      {requests.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>From</th>
              <th>Topic</th>
              <th>Message</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>
                  <Pill tone={request.status === 'open' ? 'bad' : 'good'}>{request.status}</Pill>
                </td>
                <td>
                  {/* Her account as it is today, looked up by id: the message's own
                      copy of her name is from the day she wrote it. */}
                  <PersonLink
                    person={personLabelWithCopy(
                      request.requesterUid,
                      data.users,
                      request.requester,
                    )}
                    onOpen={onOpenUser}
                  />
                </td>
                <td>{humanize(request.topic)}</td>
                <td>{request.message}</td>
                <td>{formatShortDate(request.createdAt)}</td>
                <td>
                  {request.status === 'resolved' ? (
                    <span className="cell-note">Resolved</span>
                  ) : (
                    <button onClick={() => setResolving(request)}>Resolve</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No support messages yet" body="General contact-us messages land here." />
      )}

      <ActionDialog
        open={resolving !== null}
        title="Resolve support request"
        description="Marks this support message resolved and records your note in the audit log."
        confirmLabel="Mark resolved"
        danger={error ?? undefined}
        busy={busy}
        onConfirm={(notes) => void run(notes)}
        onClose={() => {
          setResolving(null);
          setError(null);
        }}
      />
    </Panel>
  );
}
