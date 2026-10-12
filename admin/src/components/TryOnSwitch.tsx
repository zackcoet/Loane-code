/**
 * The try-on master switch.
 *
 * A switch rather than a deploy, because the first thing we will want
 * to do if a generation bill or a bad result shows up is turn it off in
 * ten seconds.
 *
 * It reads `config/tryOn` live and writes through `setTryOnConfig`,
 * which audits — the rules refuse a write from any client, admin
 * included. A switch that turns on spending is not flippable from a
 * phone.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS } from '@loane/shared';
import { db } from '../firebase/config';
import { Panel } from './ui';
import { ActionDialog } from './ActionDialog';
import { adminErrorMessage, setTryOnConfig } from '../data/adminActions';

export function TryOnSwitch() {
  const [config, setConfig] = useState<{ enabled: boolean; enabledForAdmins: boolean } | null>(
    null,
  );
  const [pending, setPending] = useState<{ enabled?: boolean; enabledForAdmins?: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, COLLECTIONS.config, 'tryOn'),
        (snap) => {
          const data = snap.data() as
            | { enabled?: boolean; enabledForAdmins?: boolean }
            | undefined;
          setConfig({
            // Off unless the document says otherwise. A missing config
            // is not an open door.
            enabled: data?.enabled ?? false,
            enabledForAdmins: data?.enabledForAdmins ?? true,
          });
        },
        () => setConfig({ enabled: false, enabledForAdmins: false }),
      ),
    [],
  );

  const run = async (reason: string) => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await setTryOnConfig({ ...pending, reason });
      setPending(null);
    } catch (err) {
      setError(adminErrorMessage(err, 'Could not change that.'));
    } finally {
      setBusy(false);
    }
  };

  const on = config?.enabled ?? false;
  const adminsOnly = !on && (config?.enabledForAdmins ?? false);

  return (
    <Panel
      title="AI Try-On"
      kicker={on ? 'On for everyone' : adminsOnly ? 'Admins only' : 'Off'}
    >
      <p className="muted">
        Each generation costs about $0.08 unless it comes from the cache. Students get 5 free for
        life; give more from a student&apos;s page.
      </p>
      <div className="row-actions" style={{ marginTop: 12 }}>
        <button className="outline-button" onClick={() => setPending({ enabled: !on })}>
          {on ? 'Turn off for everyone' : 'Turn on for everyone'}
        </button>
        <button
          className="outline-button"
          onClick={() => setPending({ enabledForAdmins: !(config?.enabledForAdmins ?? false) })}
        >
          {config?.enabledForAdmins ? 'Stop admin preview' : 'Allow admin preview'}
        </button>
      </div>

      <ActionDialog
        open={pending !== null}
        title="Change the try-on switch?"
        description={
          pending?.enabled === true
            ? 'Every student on a live campus can generate try-ons. This spends money.'
            : pending?.enabled === false
              ? 'Try-on disappears for students. Admin preview is unaffected.'
              : pending?.enabledForAdmins
                ? 'Admins can use try-on before students can.'
                : 'Admins lose access too. Nobody can generate anything.'
        }
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
