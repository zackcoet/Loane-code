/**
 * The dialog behind every admin action.
 *
 * It always asks for a reason, because every action writes an audit row
 * and a log full of blanks is not a log. The confirm button stays
 * disabled until something is typed.
 */

import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  /** What this will actually do, in plain words. */
  description: string;
  confirmLabel: string;
  /** Extra controls, e.g. an outcome picker. */
  children?: ReactNode;
  /** Shown as a warning strip. */
  danger?: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function ActionDialog({
  open,
  title,
  description,
  confirmLabel,
  children,
  danger,
  busy,
  onConfirm,
  onClose,
}: Props) {
  const [reason, setReason] = useState('');

  // Never carry one action's reason into the next.
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog">
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-description">{description}</p>

        {danger ? <p className="dialog-danger">{danger}</p> : null}

        {children}

        <label className="dialog-label" htmlFor="admin-reason">
          Reason (recorded in the audit log)
        </label>
        <textarea
          id="admin-reason"
          className="dialog-input"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="What you found, and what you decided."
        />

        <div className="dialog-actions">
          <button className="link" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={!reason.trim() || busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
