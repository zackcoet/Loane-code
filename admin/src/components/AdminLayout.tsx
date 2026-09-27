import type { ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { NAV_ITEMS, PAGE_LABELS, type Page } from '../types';
import { BrandVariables } from './BrandVariables';

interface Props {
  adminEmail: string | null;
  children: ReactNode;
  page: Page;
  title: string;
  onPageChange: (page: Page) => void;
}

export function AdminLayout({ adminEmail, children, page, title, onPageChange }: Props) {
  return (
    <div className="admin-shell">
      <BrandVariables />
      <aside className="sidebar">
        <div className="brand-mark" aria-label="Loane">
          <span>L</span>
          <span>O</span>
          <span>A</span>
          <span>N</span>
          <span>E</span>
        </div>
        <nav className="nav-list" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              className={item === page ? 'nav-item active' : 'nav-item'}
              onClick={() => onPageChange(item)}
            >
              {PAGE_LABELS[item]}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="label">Loane Admin</p>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            {adminEmail ? <span className="muted">{adminEmail}</span> : null}
            <button className="text-button" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}
