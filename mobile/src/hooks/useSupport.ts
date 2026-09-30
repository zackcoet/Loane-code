import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Report, type SupportRequest } from '@loane/shared';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../firebase/config';

export function useMyReports() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(collection(db, COLLECTIONS.reports), where('reporterUid', '==', uid)),
      (snap) => {
        setReports(snap.docs.map((d) => ({ ...(d.data() as Report), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { reports: sortNewest(reports), loading };
}

export function useMySupportRequests() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(collection(db, COLLECTIONS.supportRequests), where('requesterUid', '==', uid)),
      (snap) => {
        setRequests(snap.docs.map((d) => ({ ...(d.data() as SupportRequest), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { requests: sortNewest(requests), loading };
}

function sortNewest<T extends { createdAt: unknown }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

function toMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value && typeof value === 'object' && 'seconds' in value) {
    return Number((value as { seconds: number }).seconds) * 1000;
  }
  return 0;
}
