import { useMemo, useState } from 'react';
import type { LegalDoc, LegalDocKind } from '@loane/shared';
import { adminErrorMessage, publishLegalDoc, saveLegalDraft } from '../data/adminActions';
import type { AdminData } from '../data/adminData';

const KINDS: Array<{ kind: LegalDocKind; label: string }> = [
  { kind: 'terms', label: 'Terms & Conditions' },
  { kind: 'privacy', label: 'Privacy Policy' },
];

export function LegalPage({ data }: { data: AdminData }) {
  const [kind, setKind] = useState<LegalDocKind>('terms');
  const latest = useMemo(() => latestDoc(data.legalDocs, kind), [data.legalDocs, kind]);
  const draft = data.legalDrafts.find((item) => item.kind === kind) ?? null;
  const [text, setText] = useState(draft?.text ?? latest?.text ?? '');
  const [effectiveDate, setEffectiveDate] = useState(
    draft?.effectiveDate ?? latest?.effectiveDate ?? new Date().toISOString().slice(0, 10),
  );
  const [significantChange, setSignificantChange] = useState(draft?.significantChange ?? false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectKind = (next: LegalDocKind) => {
    const nextLatest = latestDoc(data.legalDocs, next);
    const nextDraft = data.legalDrafts.find((item) => item.kind === next) ?? null;
    setKind(next);
    setText(nextDraft?.text ?? nextLatest?.text ?? '');
    setEffectiveDate(
      nextDraft?.effectiveDate ??
        nextLatest?.effectiveDate ??
        new Date().toISOString().slice(0, 10),
    );
    setSignificantChange(nextDraft?.significantChange ?? false);
    setMessage(null);
  };

  const run = async (action: 'draft' | 'publish') => {
    setBusy(true);
    setMessage(null);
    try {
      if (action === 'draft') {
        const result = await saveLegalDraft({ kind, text, effectiveDate, significantChange });
        setMessage(`Draft saved for version ${result.data.nextVersion}.`);
      } else {
        const result = await publishLegalDoc({ kind, text, effectiveDate, significantChange });
        setMessage(`Published version ${result.data.version}. Refresh to see it in the history.`);
      }
    } catch (error) {
      setMessage(adminErrorMessage(error, 'Could not save that legal document.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="legal-page">
      <div className="toolbar">
        <div className="segmented">
          {KINDS.map((item) => (
            <button
              key={item.kind}
              className={item.kind === kind ? 'active' : ''}
              onClick={() => selectKind(item.kind)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="muted">
          Current version:{' '}
          {latest ? `v${latest.version}, effective ${latest.effectiveDate}` : 'None'}
        </span>
      </div>

      <div className="legal-editor-grid">
        <div className="panel">
          <div className="legal-editor-head">
            <div>
              <p className="label">Markdown editor</p>
              <h2>{KINDS.find((item) => item.kind === kind)?.label}</h2>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={significantChange}
                onChange={(event) => setSignificantChange(event.target.checked)}
              />
              Significant change
            </label>
          </div>
          <label className="field-label">
            Effective date
            <input
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
            />
          </label>
          <textarea
            className="legal-textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="toolbar">
            <button className="outline-button" disabled={busy} onClick={() => void run('draft')}>
              Save draft
            </button>
            <button className="primary compact" disabled={busy} onClick={() => void run('publish')}>
              Publish new version
            </button>
            {message ? <span className="muted">{message}</span> : null}
          </div>
        </div>

        <div className="panel legal-preview">
          <p className="label">Live preview</p>
          <MarkdownPreview text={text} />
        </div>
      </div>
    </section>
  );
}

function latestDoc(docs: LegalDoc[], kind: LegalDocKind): LegalDoc | null {
  return docs.filter((doc) => doc.kind === kind).sort((a, b) => b.version - a.version)[0] ?? null;
}

function MarkdownPreview({ text }: { text: string }) {
  return (
    <div className="markdown-preview">
      {text.split('\n').map((line, index) => {
        const key = `${index}-${line.slice(0, 10)}`;
        if (!line.trim()) return <br key={key} />;
        if (line.startsWith('# ')) return <h1 key={key}>{line.replace(/^#\s+/, '')}</h1>;
        if (line.startsWith('## ')) return <h2 key={key}>{line.replace(/^##\s+/, '')}</h2>;
        if (line.startsWith('- ')) return <p key={key}>• {clean(line.slice(2))}</p>;
        return <p key={key}>{clean(line)}</p>;
      })}
    </div>
  );
}

function clean(value: string) {
  return value.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}
