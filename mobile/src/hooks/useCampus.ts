/**
 * Loads the signed-in student's campus.
 *
 * The campus name and its color both come from the `campuses` collection,
 * not from anything hardcoded here, so adding a second school is a data
 * change rather than a code change.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS, colors, type Campus } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

export interface CampusView {
  campus: Campus | null;
  /** Name to show in the selector, e.g. "University of South Carolina". */
  name: string;
  /** The school's color for the dot beside the name. */
  dotColor: string;
  loading: boolean;
}

/**
 * Loads any campus by id. Used on another student's profile, where the
 * campus may one day differ from the viewer's own.
 */
export function useCampusName(campusId: string | null | undefined): CampusView {
  const [campus, setCampus] = useState<Campus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campusId) {
      setCampus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      doc(db, COLLECTIONS.campuses, campusId),
      (snap) => {
        setCampus(snap.exists() ? (snap.data() as Campus) : null);
        setLoading(false);
      },
      () => {
        setCampus(null);
        setLoading(false);
      },
    );
  }, [campusId]);

  return {
    campus,
    name: campus?.name ?? 'Your campus',
    dotColor: campus?.brandColor ?? colors.campusDotFallback,
    loading,
  };
}

/** The signed-in student's own campus. */
export function useCampus(): CampusView {
  const { profile } = useAuth();
  return useCampusName(profile?.campusId ?? null);
}
