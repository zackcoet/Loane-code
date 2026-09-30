import {
  COLLECTIONS,
  type AdminAction,
  type AppEvent,
  type Booking,
  type Campus,
  type Comment,
  type DamageClaim,
  type Listing,
  type Post,
  type Report,
  type SupportRequest,
  type Timestampish,
  type User,
} from '@loane/shared';
import { collection, getDocs, limit, orderBy, query, type QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface AdminData {
  users: User[];
  campuses: Campus[];
  listings: Listing[];
  posts: Post[];
  comments: Comment[];
  bookings: Booking[];
  reports: Report[];
  supportRequests: SupportRequest[];
  damageClaims: DamageClaim[];
  adminActions: AdminAction[];
  events: AppEvent[];
}

const COLLECTION_LIMITS = {
  users: 250,
  campuses: 50,
  listings: 250,
  posts: 250,
  comments: 250,
  bookings: 250,
  reports: 100,
  supportRequests: 100,
  damageClaims: 100,
  adminActions: 100,
  events: 500,
} as const;

export type DateRangeKey = '7d' | '30d' | 'all';

export interface DateWindow {
  key: DateRangeKey;
  label: string;
  start: Date | null;
  end: Date;
  previousStart: Date | null;
  previousEnd: Date | null;
}

export async function loadAdminData(): Promise<AdminData> {
  const [
    users,
    campuses,
    listings,
    posts,
    comments,
    bookings,
    reports,
    supportRequests,
    damageClaims,
    adminActions,
    events,
  ] = await Promise.all([
    getCollection<User>(COLLECTIONS.users, COLLECTION_LIMITS.users, true),
    getCollection<Campus>(COLLECTIONS.campuses, COLLECTION_LIMITS.campuses, false),
    getCollection<Listing>(COLLECTIONS.listings, COLLECTION_LIMITS.listings, true),
    getCollection<Post>(COLLECTIONS.posts, COLLECTION_LIMITS.posts, true),
    getCollection<Comment>(COLLECTIONS.comments, COLLECTION_LIMITS.comments, true),
    getCollection<Booking>(COLLECTIONS.bookings, COLLECTION_LIMITS.bookings, true),
    getCollection<Report>(COLLECTIONS.reports, COLLECTION_LIMITS.reports, true),
    getCollection<SupportRequest>(
      COLLECTIONS.supportRequests,
      COLLECTION_LIMITS.supportRequests,
      true,
    ),
    getCollection<DamageClaim>(COLLECTIONS.damageClaims, COLLECTION_LIMITS.damageClaims, true),
    getCollection<AdminAction>(COLLECTIONS.adminActions, COLLECTION_LIMITS.adminActions, true),
    getCollection<AppEvent>(COLLECTIONS.events, COLLECTION_LIMITS.events, true),
  ]);

  return {
    users,
    campuses,
    listings,
    posts,
    comments,
    bookings,
    reports,
    supportRequests,
    damageClaims,
    adminActions,
    events,
  };
}

async function getCollection<T>(
  name: string,
  readLimit: number,
  newestFirst: boolean,
): Promise<T[]> {
  const constraints: QueryConstraint[] = newestFirst ? [orderBy('createdAt', 'desc')] : [];
  constraints.push(limit(readLimit));
  const snap = await getDocs(query(collection(db, name), ...constraints));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T);
}

export function getDateWindow(key: DateRangeKey): DateWindow {
  const end = endOfToday();
  if (key === 'all') {
    return { key, label: 'All time', start: null, end, previousStart: null, previousEnd: null };
  }

  const days = key === '7d' ? 7 : 30;
  const start = addDays(end, -days);
  const previousStart = addDays(start, -days);
  return {
    key,
    label: key === '7d' ? 'Last 7 days' : 'Last 30 days',
    start,
    end,
    previousStart,
    previousEnd: start,
  };
}

export function toDate(value: Timestampish | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if ('seconds' in value) return new Date(value.seconds * 1000);
  return null;
}

export function isInWindow(value: Timestampish | null | undefined, window: DateWindow): boolean {
  const date = toDate(value);
  if (!date) return false;
  if (window.start && date < window.start) return false;
  return date <= window.end;
}

export function isInPreviousWindow(
  value: Timestampish | null | undefined,
  window: DateWindow,
): boolean {
  if (!window.previousStart || !window.previousEnd) return false;
  const date = toDate(value);
  if (!date) return false;
  return date >= window.previousStart && date < window.previousEnd;
}

export function matchesCampus<T extends { campusId?: string | null }>(
  item: T,
  campusId: string,
): boolean {
  return campusId === 'all' || item.campusId === campusId;
}

export function formatDate(value: Timestampish | null | undefined): string {
  const date = toDate(value);
  if (!date) return 'Not recorded';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    date,
  );
}

export function formatShortDate(value: Timestampish | null | undefined): string {
  const date = toDate(value);
  if (!date) return 'None';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function changeLabel(current: number, previous: number, allTime: boolean): string {
  if (allTime) return 'All time';
  const diff = current - previous;
  if (diff === 0) return 'No change';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toLocaleString()} vs last period`;
}

export function downloadCsv(fileName: string, rows: Array<Record<string, string | number | null>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0] ?? {});
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function weekKey(value: Timestampish | null | undefined): string {
  const date = toDate(value);
  if (!date) return 'Unknown';
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

export function dayKey(value: Timestampish | null | undefined): string {
  const date = toDate(value);
  if (!date) return 'Unknown';
  return date.toISOString().slice(0, 10);
}

export function humanize(value: string): string {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function endOfToday(): Date {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
