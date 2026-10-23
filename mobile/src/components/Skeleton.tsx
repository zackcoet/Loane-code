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
import { color, radius, spacing } from '@loane/shared';

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
 *
 * `gutter` is the space between tiles (profiles use a 2pt hairline,
 * like Instagram). `captions` adds two short lines under each tile, for
 * grids of pieces that carry a name and price underneath.
 */
export function SkeletonGrid({
  count = 6,
  columns = 2,
  aspectRatio = 0.8,
  gutter = spacing.md,
  captions = false,
}: {
  count?: number;
  columns?: number;
  aspectRatio?: number;
  gutter?: number;
  captions?: boolean;
}) {
  const pulse = usePulse();
  return (
    <Animated.View
      style={pulse}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <GridShapes
        count={count}
        columns={columns}
        aspectRatio={aspectRatio}
        gutter={gutter}
        captions={captions}
      />
    </Animated.View>
  );
}

/** The tiles alone, so a profile skeleton can put them under its header. */
function GridShapes({
  count,
  columns,
  aspectRatio,
  gutter,
  captions,
}: {
  count: number;
  columns: number;
  aspectRatio: number;
  gutter: number;
  captions: boolean;
}) {
  // Gaps are padding on each cell; half on each side makes a full gap between.
  const width = `${100 / columns}%` as DimensionValue;
  const half = gutter / 2;
  return (
    <View style={[styles.grid, { padding: half }]} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width, padding: half }}>
          <View style={[styles.block, { aspectRatio, width: '100%' }]} />
          {captions ? (
            <View style={styles.caption}>
              <Bar width={i % 2 === 0 ? '70%' : '55%'} height={10} />
              <Bar width="30%" height={10} />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * One look or one piece: the big photo, who it belongs to, then a few
 * lines of words. `aspectRatio` matches the real photo on that page.
 */
export function SkeletonDetail({ aspectRatio = 0.8 }: { aspectRatio?: number }) {
  const pulse = usePulse();
  return (
    <Animated.View
      style={pulse}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <View importantForAccessibility="no-hide-descendants">
        <View style={[styles.block, { aspectRatio, width: '100%' }]} />
        <View style={styles.detailBody}>
          <View style={styles.row}>
            <View style={[styles.block, styles.round, { width: 36, height: 36 }]} />
            <View style={styles.lines}>
              <Bar width="40%" />
              <Bar width="25%" height={10} />
            </View>
          </View>
          <Bar width="85%" />
          <Bar width="70%" />
          <Bar width="50%" />
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * A profile: the round photo and her name, the counts, then three
 * across of closet tiles with the same 2pt hairline the real grid uses.
 */
export function SkeletonProfile() {
  const pulse = usePulse();
  return (
    <Animated.View
      style={pulse}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <View importantForAccessibility="no-hide-descendants">
        <View style={styles.profileTop}>
          <View style={[styles.block, styles.round, { width: 72, height: 72 }]} />
          <View style={styles.lines}>
            <Bar width="50%" height={14} />
            <Bar width="35%" height={10} />
            <Bar width="70%" height={10} />
          </View>
        </View>
        <GridShapes count={9} columns={3} aspectRatio={1} gutter={2} captions={false} />
      </View>
    </Animated.View>
  );
}

/**
 * A chat: bubbles on both sides, hers on the right, so the screen
 * already looks like a conversation before the first message lands.
 */
export function SkeletonChat() {
  const pulse = usePulse();
  // Fixed pattern rather than random, so it never shifts between renders.
  const bubbles: { mine: boolean; width: DimensionValue }[] = [
    { mine: false, width: '55%' },
    { mine: false, width: '35%' },
    { mine: true, width: '60%' },
    { mine: false, width: '45%' },
    { mine: true, width: '30%' },
    { mine: true, width: '50%' },
  ];
  return (
    <Animated.View
      style={[styles.chat, pulse]}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {bubbles.map((b, i) => (
        <View
          key={i}
          style={[styles.bubbleRow, b.mine && styles.bubbleMine]}
          importantForAccessibility="no-hide-descendants"
        >
          <View style={[styles.block, styles.bubble, { width: b.width }]} />
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
  round: { borderRadius: radius.pill },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  caption: { gap: spacing.xs, paddingTop: spacing.sm },
  detailBody: { padding: spacing.md, gap: spacing.sm },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  // Chat bubbles are the one rounded shape: the real bubbles are rounded.
  chat: { flex: 1, justifyContent: 'flex-end', padding: spacing.md, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  bubbleMine: { justifyContent: 'flex-end' },
  bubble: { height: 36, borderRadius: radius.lg },
});
