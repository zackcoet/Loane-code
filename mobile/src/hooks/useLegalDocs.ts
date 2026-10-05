import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { COLLECTIONS, type LegalDoc, type LegalDocKind } from '@loane/shared';
import { db } from '../firebase/config';

export interface LatestLegalDocs {
  terms: LegalDoc | null;
  privacy: LegalDoc | null;
}

function latestOf(kind: LegalDocKind, docs: LegalDoc[]): LegalDoc | null {
  return docs.filter((doc) => doc.kind === kind).sort((a, b) => b.version - a.version)[0] ?? null;
}

export function useLatestLegalDocs() {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDocs(collection(db, COLLECTIONS.legalDocs))
      .then((snap) => {
        if (cancelled) return;
        setDocs(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as LegalDoc));
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the legal documents.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = useMemo<LatestLegalDocs>(
    () => ({ terms: latestOf('terms', docs), privacy: latestOf('privacy', docs) }),
    [docs],
  );

  return { latest, loading, error };
}
