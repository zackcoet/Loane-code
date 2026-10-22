/**
 * The switchboard: every risky or unfinished feature on one panel.
 *
 * Reads `config/features` live and writes through `setFeatureFlag`,
 * which audits every flip and refuses to turn on a switch whose setup
 * does not exist yet (payments, email codes). The rules refuse a write
 * from any client, admin included.
 *
 * Replaced the try-on-only panel in autopilot run 13; try-on's two
 * switches are the first two rows here.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  COLLECTIONS,
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAG_INFO,
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS_DOC,
  resolveFeatureFlags,
  type FeatureFlagKey,
  type FeatureFlags,
} from '@loane/shared';
import { db } from '../firebase/config';
import { Panel } from './ui';
import { ActionDialog } from './ActionDialog';
import { adminErrorMessage, setFeatureFlag } from '../data/adminActions';

export function FeatureSwitches() {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [pending, setPending] = useState<{ flag: FeatureFlagKey; value: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, COLLECTIONS.config, FEATURE_FLAGS_DOC),
        (snap) => setFlags(resolveFeatureFlags(snap.data())),
        // Unreadable shows the defaults, which is what the server uses too.
        () => setFlags({ ...FEATURE_FLAG_DEFAULTS }),
      ),
    [],
  );

  const run = async (reason: string) => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await setFeatureFlag({ ...pending, reason });
      setPending(null);
    } catch (err) {
      setError(adminErrorMessage(err, 'Could not change that.'));
    } finally {
      setBusy(false);
    }
  };

  const info = pending ? FEATURE_FLAG_INFO[pending.flag] : null;

  return (
    <Panel title="Feature switches" kicker="Change without a new app build">
      <table className="data-table compact">
        <tbody>
          {FEATURE_FLAG_KEYS.map((key) => {
            const on = flags?.[key] ?? FEATURE_FLAG_DEFAULTS[key];
            const { label, description, lockedReason } = FEATURE_FLAG_INFO[key];
            const locked = !on && lockedReason !== null;
            return (
              <tr key={key}>
                <td>
                  <strong>{label}</strong>
                  <p className="muted">{locked ? `Locked: ${lockedReason}` : description}</p>
                </td>
                <td>{on ? 'On' : 'Off'}</td>
                <td>
                  <button
                    className="outline-button"
                    disabled={flags === null || locked}
                    onClick={() => setPending({ flag: key, value: !on })}
                  >
                    {on ? 'Turn off' : 'Turn on'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ActionDialog
        open={pending !== null}
        title={`Turn ${info?.label ?? ''} ${pending?.value ? 'on' : 'off'}?`}
        description={info?.description ?? ''}
        confirmLabel="Change it"
        danger={error ?? undefined}
        busy={busy}
        onConfirm={(reason) => void run(reason)}
        onClose={() => {
          setPending(null);
          setError(null);
        }}
      />
    </Panel>
  );
}
