/**
 * The Loane mark: two overlapping circles with L O A N E spaced across them.
 *
 * Drawn rather than imported as an image so it stays crisp at any size and
 * we are not blocked on an asset export.
 *
 * At large sizes the wordmark sits across the circles, as on the splash
 * screen. Below `WORDMARK_INSIDE_MIN` the letters would be illegible inside
 * the rings, so it drops below the mark instead — which is how the header
 * lockup looks in the mockups.
 */

import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@loane/shared';

/** Smallest circle diameter that can carry the wordmark inside it. */
const WORDMARK_INSIDE_MIN = 56;

interface Props {
  size?: number;
  showWordmark?: boolean;
  color?: string;
}

export function Logo({ size = 96, showWordmark = true, color = colors.black }: Props) {
  const diameter = size;
  const overlap = diameter * 0.42;
  const width = diameter * 2 - overlap;
  const inside = diameter >= WORDMARK_INSIDE_MIN;

  const circle = {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    borderWidth: Math.max(1, diameter * 0.012),
    borderColor: color,
  };

  const mark = (
    <View style={[styles.mark, { width, height: diameter }]}>
      <View style={[styles.circle, circle, { left: 0 }]} />
      <View style={[styles.circle, circle, { left: diameter - overlap }]} />
      {showWordmark && inside ? (
        <View style={[styles.wordmarkRow, { width }]}>
          {['L', 'O', 'A', 'N', 'E'].map((letter) => (
            <Text key={letter} style={[styles.letter, { fontSize: diameter * 0.26, color }]}>
              {letter}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (!showWordmark || inside) return mark;

  return (
    <View style={styles.stack}>
      {mark}
      <Text style={[styles.wordmarkBelow, { fontSize: Math.max(9, diameter * 0.42), color }]}>
        LOANE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: 'center' },
  mark: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', top: 0 },
  wordmarkRow: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    height: '100%',
  },
  letter: { fontWeight: '400', letterSpacing: 1 },
  wordmarkBelow: { marginTop: 4, letterSpacing: 3, fontWeight: '400' },
});
