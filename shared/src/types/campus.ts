import type { BaseDoc } from './common';

/**
 * `campuses/{campusId}`
 *
 * The approved-school list. A user's email domain is checked against
 * `emailDomains` to decide which campus she belongs to.
 *
 * Only admins write this collection. Everyone signed in may read it.
 * Launch campus: id "university-of-south-carolina".
 */
export interface Campus extends BaseDoc {
  /** e.g. "University of South Carolina". */
  name: string;
  /** e.g. "USC". Ambiguous in the real world, so never used as an id. */
  shortName: string;
  /** Lowercased domains we accept, e.g. ["sc.edu", "email.sc.edu"]. */
  emailDomains: string[];
  city: string;
  state: string;
  /**
   * The school's color, used for the small dot beside the campus name.
   * Stored per campus so a new school needs no code change.
   *
   * We use the color and never the official logo — university marks are
   * trademarked and we have no license to display them.
   */
  brandColor: string;
  /** Whether students may sign up for this campus yet. */
  isLive: boolean;
  /** Counts kept up to date by Cloud Functions. Never written by the app. */
  stats: {
    userCount: number;
    verifiedUserCount: number;
    listingCount: number;
    postCount: number;
    bookingCount: number;
  };
}
