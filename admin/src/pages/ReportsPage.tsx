import { useState } from 'react';
import type { Report } from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { formatShortDate, humanize, matchesCampus } from '../data/adminData';
import { EmptyState, Panel, Pill } from '../components/ui';
import { ActionDialog } from '../components/ActionDialog';
import { adminErrorMessage, resolveReport } from '../data/adminActions';

/**
 * The reports queue.
 *
 * Open ones come first, because a closed report is history and an open
 * one is a student waiting.
 *
 * Acting and closing are one step. If a report says a listing is
 * counterfeit, taking the listing down, suspending the seller and
 * closing the report happen together and produce three linked audit
 * rows. Three separate clicks is how moderation ends up half-finished.
 */

type Action = 'none' | 'content_removed' | 'user_warned' | 'user_suspended';

const ACTIONS: { value: Action; label: string }[] = [
  { value: 'none', label: 'No action' },
  { value: 'content_removed', label: 'Take the content down' },
  { value: 'user_warned', label: 'Warn her' },
  { value: 'user_suspended', label: 'Suspend her' },
];

const STATUS_TONE: Record<string, 'good' | 'warn' | 'bad' | 'neutral'> = {
  open: 'bad',
  reviewing: 'warn',
  actioned: 'good',
  dismissed: 'neutral',
};

export function ReportsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const reports = [...data.reports.filter((report) => matchesCampus(report, campusId))].sort(
    (a, b) => rank(a) - rank(b),
  );

  const [working, setWorking] = useState<{ report: Report; closing: boolean } | null>(null);
  const [action, setAction] = useState<Action>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = reports.filter((r) => r.status === 'open' || r.status === 'reviewing').length;

  const run = async (status: 'reviewing' | 'actioned' | 'dismissed', notes: string) => {
    if (!working) return;
    setBusy(true);
    setError(null);
    try {
      await resolveReport({
        reportId: working.report.id,
        status,
        action: status === 'actioned' ? action : undefined,
        notes,
      });
      setWorking(null);
      setAction('none');
    } catch (err) {
      setError(adminErrorMessage(err, 'Could not save that.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Reports Queue" kicker={`${open} need attention · ${reports.length} total`}>
      {reports.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Target</th>
              <th>Reason</th>
              <th>Details</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const closed = report.status === 'actioned' || report.status === 'dismissed';
              return (
                <tr key={report.id}>
                  <td>
                    <Pill tone={STATUS_TONE[report.status] ?? 'neutral'}>{report.status}</Pill>
                  </td>
                  <td>{report.targetType}</td>
                  <td>{humanize(report.reason)}</td>
                  <td>
                    {report.details}
                    {report.resolution?.notes ? (
                      <div className="cell-note">Decision: {report.resolution.notes}</div>
                    ) : null}
                  </td>
                  <td>{formatShortDate(report.createdAt)}</td>
                  <td>
                    {closed ? (
                      <span className="cell-note">Closed</span>
                    ) : (
                      <div className="row-actions">
                        {report.status === 'open' ? (
                          <button onClick={() => setWorking({ report, closing: false })}>
                            Claim
                          </button>
                        ) : null}
                        <button onClick={() => setWorking({ report, closing: true })}>
                          Resolve
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <EmptyState
          title="No reports yet"
          body="Reported users, listings, posts and rentals land here."
        />
      )}

      <ActionDialog
        open={working !== null}
        title={working?.closing ? 'Resolve this report' : 'Claim this report'}
        description={
          working?.closing
            ? 'Pick what you are doing about it. Whatever you choose happens now, in the same step as closing the report.'
            : 'Marks it as being looked at, so nobody else writes to her about the same thing.'
        }
        confirmLabel={working?.closing ? 'Action it' : 'Claim'}
        danger={
          working?.closing && action === 'user_suspended'
            ? 'She will be suspended immediately and told why.'
            : error ?? undefined
        }
        busy={busy}
        onConfirm={(reason) => void run(working?.closing ? 'actioned' : 'reviewing', reason)}
        onClose={() => {
          setWorking(null);
          setError(null);
        }}
      >
        {working?.closing ? (
          <>
            <div className="dialog-choices">
              {ACTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`choice ${action === option.value ? 'on' : ''}`}
                  onClick={() => setAction(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="cell-note">
              Choosing nothing and confirming marks it actioned with no change. To close it as
              not a problem, use Dismiss below.
            </p>
            <div className="row-actions" style={{ marginTop: 8 }}>
              <button
                onClick={() => {
                  const reason = window.prompt('Why are you dismissing this?');
                  if (reason?.trim()) void run('dismissed', reason.trim());
                }}
              >
                Dismiss instead
              </button>
            </div>
          </>
        ) : null}
      </ActionDialog>
    </Panel>
  );
}

/** Open first, then being looked at, then everything closed. */
function rank(report: Report): number {
  if (report.status === 'open') return 0;
  if (report.status === 'reviewing') return 1;
  return 2;
}
