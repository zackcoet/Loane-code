/**
 * Reading bookings.
 *
 * The security rules only let each side see their own bookings, so every
 * query here is scoped to the signed-in user one way or another.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Booking, type IsoDate, type Listing } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

/** Her rentals, on one side or the other. */
export function useMyBookings(side: 'renting' | 'lending') {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.bookings),
        where(side === 'renting' ? 'renterUid' : 'lenderUid', '==', uid),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
        setBookings(snap.docs.map((d) => ({ ...(d.data() as Booking), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid, side]);

  return { bookings, loading };
}

export function useBooking(bookingId: string | undefined) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      doc(db, COLLECTIONS.bookings, bookingId),
      (snap) => {
        setBooking(snap.exists() ? { ...(snap.data() as Booking), id: snap.id } : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [bookingId]);

  return { booking, loading };
}

/**
 * Every day a listing cannot be rented: the owner's blocked days plus the
 * days already taken.
 *
 * Both come off the LISTING, not the bookings collection — a renter is
 * not allowed to read other people's bookings, and should not be. A
 * Cloud Function publishes the taken dates onto the listing as dates
 * only, with nothing about who has it. See syncListingAvailability.
 */
export function useUnavailableDates(listing: Listing | null | undefined) {
  return useMemo(
    () => new Set<IsoDate>([...(listing?.blackoutDates ?? []), ...(listing?.bookedDates ?? [])]),
    [listing?.blackoutDates, listing?.bookedDates],
  );
}
