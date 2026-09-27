import type { ReactNode } from 'react';
import type { Campus, User } from '@loane/shared';

export function Loading() {
  return (
    <main className="content">
      <p className="muted">Loading admin data...</p>
    </main>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

export function Panel({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) {
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

export function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="metric-card">
      <p className="label">{label}</p>
      <strong>{value.toLocaleString()}</strong>
      <span>{detail}</span>
    </article>
  );
}

export function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value.toLocaleString()}</strong>
      <span className="label">{label}</span>
    </div>
  );
}

export function Pill({
  children,
  tone,
}: {
  children: ReactNode;
  /** `bad` is for things a human has to act on, e.g. a flagged return. */
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <p className="label">{title}</p>
      <p>{body}</p>
    </div>
  );
}

export function CampusSelect({
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

export function Segmented({
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

export function Pagination({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="pagination">
      <span>
        Page {page + 1} of {pageCount} · {total.toLocaleString()} loaded
      </span>
      <div>
        <button className="outline-button" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <button
          className="outline-button"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function ImageBlock({ imageUrl, alt }: { imageUrl: string | null; alt: string }) {
  return imageUrl ? (
    <img src={imageUrl} alt={alt} className="thumb" />
  ) : (
    <div className="thumb placeholder" aria-label={alt} />
  );
}

export function Avatar({ user }: { user: User }) {
  return user.photoUrl ? (
    <img src={user.photoUrl} alt={user.displayName} className="avatar" />
  ) : (
    <div className="avatar placeholder">{user.displayName.slice(0, 1)}</div>
  );
}
