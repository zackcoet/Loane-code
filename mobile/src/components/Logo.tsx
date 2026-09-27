/**
 * The Loane mark: two overlapping circles with L O A N E spaced across them.
 *
 * Drawn rather than imported as an image so it stays crisp at any size and
 * we are not blocked on an asset export.
 */

import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@loane/shared';

interface Props {
  size?: number;
  /** Show the wordmark across the circles. */
  showWordmark?: boolean;
  color?: string;
}

export function Logo({ size = 96, showWordmark = true, color = colors.black }: Props) {
  const diameter = size;
  const overlap = diameter * 0.42;
  const width = diameter * 2 - overlap;

  const circle = {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    borderWidth: Math.max(1, diameter * 0.012),
    borderColor: color,
  };

  return (
    <View style={[styles.wrapper, { width, height: diameter }]}>
      <View style={[styles.circle, circle, { left: 0 }]} />
      <View style={[styles.circle, circle, { left: diameter - overlap }]} />
      {showWordmark ? (
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
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', top: 0 },
  wordmarkRow: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    height: '100%',
  },
  letter: { fontWeight: '400', letterSpacing: 1 },
});
