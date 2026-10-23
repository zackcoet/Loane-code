import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Report, type SupportRequest } from '@loane/shared';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../firebase/config';
import { useRetry } from './useRetry';
import { isCachedEmpty } from '../network/connection';

export function useMyReports() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { attempt, retry } = useRetry();

  useEffect(() => {
    setFailed(false);
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(collection(db, COLLECTIONS.reports), where('reporterUid', '==', uid)),
      (snap) => {
        // No signal and nothing cached: an empty answer here is a guess,
        // not "there are none". Say it could not load (shared/connection.ts).
        if (isCachedEmpty(snap)) {
          setFailed(true);
          setLoading(false);
          return;
        }
        setReports(snap.docs.map((d) => ({ ...(d.data() as Report), id: d.id })));
        setLoading(false);
      },
      () => {
        setFailed(true);
        setLoading(false);
      },
    );
  }, [uid, attempt]);

  return { reports: sortNewest(reports), loading, failed, retry };
}

export function useMySupportRequests() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { attempt, retry } = useRetry();

  useEffect(() => {
    setFailed(false);
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(collection(db, COLLECTIONS.supportRequests), where('requesterUid', '==', uid)),
      (snap) => {
        // No signal and nothing cached: an empty answer here is a guess,
        // not "there are none". Say it could not load (shared/connection.ts).
        if (isCachedEmpty(snap)) {
          setFailed(true);
          setLoading(false);
          return;
        }
        setRequests(snap.docs.map((d) => ({ ...(d.data() as SupportRequest), id: d.id })));
        setLoading(false);
      },
      () => {
        setFailed(true);
        setLoading(false);
      },
    );
  }, [uid, attempt]);

  return { requests: sortNewest(requests), loading, failed, retry };
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
