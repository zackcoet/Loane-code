import type { EventSurface, EventType } from '../constants';
import type { Timestampish } from './common';

/**
 * `events/{eventId}`
 *
 * Engagement tracking, logged from day one.
 *
 * These exist to answer the two MVP questions:
 *   1. Will girls rent from closets on their campus?
 *   2. Does the social experience make them more likely to discover, engage
 *      with, and come back to Loane?
 *
 * Append-only: the app may create an event and may never read, update or
 * delete one. Admins read them. Later this same stream feeds a
 * recommendation algorithm, so log generously now.
 */
export interface AppEvent {
  id: string;
  type: EventType;
  /** Null for events logged before sign-in. */
  uid: string | null;
  campusId: string | null;
  /** Where in the app it happened — lets us compare social vs marketplace. */
  surface: EventSurface;

  /** The thing acted on, when there is one. */
  targetType: 'post' | 'listing' | 'user' | 'booking' | 'search' | 'screen' | null;
  targetId: string | null;

  /**
   * Small, non-sensitive extras: the search term, which filters were used,
   * which onboarding step. Never put personal data in here.
   */
  meta: Record<string, string | number | boolean>;

  /** Groups events from one app session so we can measure return visits. */
  sessionId: string;
  platform: 'ios' | 'android' | 'web';
  appVersion: string;
  createdAt: Timestampish;
}
