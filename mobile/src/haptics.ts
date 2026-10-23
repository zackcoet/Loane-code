/**
 * Small taps you feel, on the moments that should feel physical: a
 * like, a follow, a message going out.
 *
 * Kept to a few named moments rather than sprinkled on every button —
 * buzzing on everything makes nothing feel special. A phone with
 * haptics turned off in Settings (or with none, like Android
 * emulators) simply gets nothing; a failure is never an error.
 */

import * as Haptics from 'expo-haptics';

/** A like, a heart on a comment, a save. The lightest tap. */
export function hapticLike(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Following someone. A touch firmer — it is a bigger step. */
export function hapticFollow(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** A message or comment sent. The system "it worked" pattern is too much; a light tap. */
export function hapticSend(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
