/**
 * Building blocks shared by every collection.
 */

/**
 * A timestamp. Firestore gives us a Timestamp object, the emulator seed and
 * Cloud Functions often deal in millis, and JSON gives us an ISO string. We
 * keep the type loose here and convert at the edges.
 */
export type Timestampish = { seconds: number; nanoseconds: number } | Date | number | string;

/** An ISO calendar date with no time or zone, e.g. "2026-10-04". */
export type IsoDate = string;

/** Money. Always an integer count of US cents. Never a float. */
export type Cents = number;

/** Every document carries these. */
export interface BaseDoc {
  /** The document id. Stored in the document as well so lists are easy. */
  id: string;
  createdAt: Timestampish;
  updatedAt: Timestampish;
}

/**
 * Almost everything in Loane belongs to one campus. This is what keeps a
 * USC student's feed full of USC closets.
 */
export interface CampusScoped {
  campusId: string;
}

/** An uploaded image. */
export interface ImageRef {
  /** Path inside the Storage bucket, e.g. "listings/{uid}/{listingId}/1.jpg". */
  path: string;
  /** Public download URL, filled in after upload. */
  url: string;
  width: number;
  height: number;
  /** Bytes after client-side compression. */
  bytes?: number;
}

/** A small copy of a user, denormalized so lists render without extra reads. */
export interface UserSummary {
  uid: string;
  username: string;
  displayName: string;
  photoUrl: string | null;
  campusId: string;
  isVerified: boolean;
}

/** A small copy of a listing, denormalized into posts and bookings. */
export interface ListingSummary {
  listingId: string;
  name: string;
  coverUrl: string | null;
  ownerUid: string;
  priceCents3Day: Cents | null;
  salePriceCents: Cents | null;
}

/** An inclusive-start, exclusive-end date range. */
export interface DateRange {
  /** First day the renter has the item. */
  startDate: IsoDate;
  /** Day the item comes back. The item is free again on this day. */
  endDate: IsoDate;
}
