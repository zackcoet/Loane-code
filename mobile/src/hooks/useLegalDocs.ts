import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS, type LegalDoc, type LegalDocKind } from '@loane/shared';
import { db } from '../firebase/config';

/**
 * The current Terms and Privacy Policy.
 *
 * ONE DOCUMENT PER KIND, not the whole collection.
 *
 * Published legal versions are immutable and kept forever, and each one
 * carries its entire text — up to 100,000 characters. Reading the whole
 * collection to find the newest meant every launch downloaded every
 * version of both documents ever published, in full, to show the one at
 * the top. Two documents today; ten after a year of revisions, over
 * campus wifi, for text nobody will ever read.
 *
 * Needs the legalDocs(kind ASC, version DESC) composite index.
 */

export interface LatestLegalDocs {
  terms: LegalDoc | null;
  privacy: LegalDoc | null;
}

async function fetchLatest(kind: LegalDocKind): Promise<LegalDoc | null> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.legalDocs),
      where('kind', '==', kind),
      orderBy('version', 'desc'),
      limit(1),
    ),
  );
  const doc = snap.docs[0];
  return doc ? ({ id: doc.id, ...doc.data() } as LegalDoc) : null;
}

export function useLatestLegalDocs() {
  const [latest, setLatest] = useState<LatestLegalDocs>({ terms: null, privacy: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchLatest('terms'), fetchLatest('privacy')])
      .then(([terms, privacy]) => {
        if (cancelled) return;
        setLatest({ terms, privacy });
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

  return { latest, loading, error };
}
