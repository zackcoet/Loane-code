/**
 * Engagement tracking.
 *
 * Every meaningful action writes a row to the `events` collection. This is
 * how we answer the two MVP questions:
 *
 *   1. Will girls rent from closets on their campus?
 *   2. Does the social experience make them more likely to discover, engage
 *      with, and come back to Loane?
 *
 * Logging is fire-and-forget: a failed event must never break the screen the
 * user is looking at. We log from day one because you cannot go back and
 * collect last month's data.
 */

import { Platform } from 'react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  COLLECTIONS,
  type EventSurface,
  type EventType,
} from '@loane/shared';
import { auth, db } from '../firebase/config';

/** One id per app launch, so we can measure return visits. */
const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

let currentCampusId: string | null = null;

/** Called once the signed-in user's profile loads. */
export function setAnalyticsCampus(campusId: string | null): void {
  currentCampusId = campusId;
}

interface LogOptions {
  surface?: EventSurface;
  targetType?: 'post' | 'listing' | 'user' | 'booking' | 'search' | 'screen' | null;
  targetId?: string | null;
  /** Small non-sensitive extras only. Never personal data. */
  meta?: Record<string, string | number | boolean>;
}

export function logEvent(type: EventType, options: LogOptions = {}): void {
  const uid = auth.currentUser?.uid ?? null;

  // The security rules require events to carry the caller's own uid, so we
  // simply skip logging when signed out rather than writing something the
  // server would reject.
  if (!uid) return;

  void addDoc(collection(db, COLLECTIONS.events), {
    type,
    uid,
    campusId: currentCampusId,
    surface: options.surface ?? 'other',
    targetType: options.targetType ?? null,
    targetId: options.targetId ?? null,
    meta: options.meta ?? {},
    sessionId,
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    appVersion: '0.1.0',
    createdAt: serverTimestamp(),
  }).catch(() => {
    // Analytics must never break the app.
  });
}
