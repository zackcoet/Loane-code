/**
 * The Loane mark: two overlapping circles with L O A N E spaced across them.
 *
 * Drawn rather than imported as an image so it stays crisp at any size and
 * we are not blocked on an asset export.
 *
 * The rings and the letters share one weight — see RING_RATIO and
 * LETTER_WEIGHT. They used to disagree, hairline rings against light
 * letters, and the mark read as two drawings on top of each other.
 *
 * Two lockups, matching the mockups:
 *
 *   - `across` (the splash): the letters sit on the circles, widely spaced.
 *     The circles are drawn WIDER than they are tall so the five letters get
 *     room — squeezing them into two touching circles is what made the old
 *     version look cramped.
 *   - `below` (headers): the mark on top, LOANE letter-spaced underneath.
 *     Used automatically at small sizes, where letters inside the rings
 *     would be unreadable.
 */

import { StyleSheet, Text, View } from 'react-native';
import {
  color,
} from '@loane/shared';

/** Below this circle diameter the wordmark always drops beneath the mark. */
const WORDMARK_INSIDE_MIN = 64;

/**
 * ONE weight for the whole mark.
 *
 * The rings and the letters have to look like they were drawn with the
 * same pen — that is the whole point of Ella's reference, and the old
 * mark missed it badly: hairline rings at 1.4% of the diameter against
 * letters at weight 400. At splash size that is a 1.5pt ring beside a
 * strokes-look-2.5pt letterform, and it read as two logos overlaid.
 *
 * So the ring is derived from the diameter and the letters are set to
 * the weight that matches it optically. Both come from here, so they
 * cannot drift apart again.
 */
const RING_RATIO = 0.045;
const LETTER_WEIGHT = '700' as const;

function ringWeight(diameter: number): number {
  // Never thinner than 2pt, or the rings disappear in a 28pt header.
  return Math.max(2, Math.round(diameter * RING_RATIO));
}

type Lockup = 'auto' | 'across' | 'below' | 'mark';

interface Props {
  /** Diameter of one circle, in points. */
  size?: number;
  lockup?: Lockup;
  /** Overrides the mark colour. */
  tint?: string;
}

export function Logo({ size = 96, lockup = 'auto', tint = color.icon.default }: Props) {
  const diameter = size;
  // A generous overlap keeps the classic interlocking-rings silhouette.
  const overlap = diameter * 0.38;
  const markWidth = diameter * 2 - overlap;

  const resolved: Lockup =
    lockup === 'auto' ? (diameter >= WORDMARK_INSIDE_MIN ? 'across' : 'below') : lockup;

  const circle = {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    borderWidth: ringWeight(diameter),
    borderColor: tint,
  };

  const mark = (
    <View style={[styles.mark, { width: markWidth, height: diameter }]}>
      <View style={[styles.circle, circle, { left: 0 }]} />
      <View style={[styles.circle, circle, { left: diameter - overlap }]} />
      {resolved === 'across' ? (
        <View style={[styles.acrossRow, { width: markWidth }]}>
          {['L', 'O', 'A', 'N', 'E'].map((letter) => (
            <Text
              key={letter}
              style={[
                styles.letter,
                { fontSize: diameter * 0.3, lineHeight: diameter * 0.36, color: tint },
              ]}
            >
              {letter}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (resolved !== 'below') return mark;

  return (
    <View style={styles.stack}>
      {mark}
      <Text
        style={[
          styles.wordmarkBelow,
          { fontSize: Math.max(11, diameter * 0.4), color: tint },
        ]}
      >
        LOANE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: 'center' },
  mark: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', top: 0 },
  acrossRow: {
    position: 'absolute',
    flexDirection: 'row',
    // space-around gives the outer letters breathing room against the rings;
    // space-evenly pushed L and E too close to the edges.
    justifyContent: 'space-around',
    alignItems: 'center',
    height: '100%',
    // Slight inset so L and E sit inside the circle edges.
    paddingHorizontal: '6%',
  },
  letter: { fontWeight: LETTER_WEIGHT, letterSpacing: 1 },
  wordmarkBelow: { marginTop: 5, letterSpacing: 3, fontWeight: LETTER_WEIGHT },
});
