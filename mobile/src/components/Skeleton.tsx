/**
 * Grey shapes where the content is about to be.
 *
 * For LISTS — inbox, Activity, comments, people. A skeleton tells her what
 * is coming (rows of people, a grid of pieces) so the screen never looks
 * blank or broken while the first page arrives, and nothing jumps when it
 * does. Full-screen waits that are not a list still use LoaneLoader.
 *
 * One quiet pulse, shared by every shape on screen so they breathe
 * together rather than flicker separately. Honours Reduce Motion: the
 * shapes are held still.
 *
 * Hidden from VoiceOver as shapes; the wrapper reads "Loading".
 */

import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { color, spacing } from '@loane/shared';

/** Slow on purpose: a fast pulse reads as anxious. */
const PULSE_MS = 900;

function usePulse() {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withTiming(0.45, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

function Bar({ width, height = 12 }: { width: DimensionValue; height?: number }) {
  return <View style={[styles.block, { width, height }]} />;
}

/**
 * Rows of a picture + two lines: the inbox, Activity, comments,
 * followers (round, a person), or rentals (square, a piece).
 */
export function SkeletonRows({
  count = 8,
  avatar = 44,
  shape = 'round',
}: {
  count?: number;
  avatar?: number;
  shape?: 'round' | 'square';
}) {
  const pulse = usePulse();
  return (
    <Animated.View
      style={[styles.rows, pulse]}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row} importantForAccessibility="no-hide-descendants">
          <View
            style={[
              styles.block,
              { width: avatar, height: avatar, borderRadius: shape === 'round' ? avatar / 2 : 0 },
            ]}
          />
          <View style={styles.lines}>
            {/* Varied widths, so it reads as names and messages, not a table. */}
            <Bar width={i % 3 === 0 ? '45%' : i % 3 === 1 ? '60%' : '38%'} />
            <Bar width={i % 2 === 0 ? '80%' : '65%'} height={10} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

/**
 * A grid of tiles, shaped like the grid it stands in for so nothing
 * jumps when the real one arrives. Defaults match PostGrid: two
 * columns of 4:5 looks with a gap between.
 */
export function SkeletonGrid({
  count = 6,
  columns = 2,
  aspectRatio = 0.8,
}: {
  count?: number;
  columns?: number;
  aspectRatio?: number;
}) {
  const pulse = usePulse();
  // Gaps are padding on each cell; half on each side makes a full gap between.
  const width = `${100 / columns}%` as DimensionValue;
  return (
    <Animated.View
      style={[styles.grid, pulse]}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[styles.cell, { width }]}
          importantForAccessibility="no-hide-descendants"
        >
          <View style={[styles.block, { aspectRatio, width: '100%' }]} />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Square corners, like everything else in Loane.
  block: { backgroundColor: color.surface.muted },
  rows: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  lines: { flex: 1, gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md / 2 },
  cell: { padding: spacing.md / 2 },
});
