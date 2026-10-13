/**
 * The Loane mark forming. Our loading indicator.
 *
 * ONE component for every full-screen wait — launch, sign-up, uploading
 * a post or a listing, and payment once that lands. A spinning platform
 * `ActivityIndicator` says "an app is thinking". This says "Loane is
 * thinking", and a wait is one of the few moments somebody is
 * definitely looking at the screen.
 *
 * THE TWO CIRCLES SLIDE TOGETHER AND THE BUTTER ARRIVES LAST. That is
 * the mark's own idea — two closets, and the thing that only exists
 * where they meet — so the loader draws it rather than decorating it.
 * The old loader rotated the outline mark; a filled mark rotating looks
 * like a loading spinner wearing a logo.
 *
 * It uses markPieces() from Logo.tsx rather than its own geometry. A
 * loader with its own idea of where the circles go is a second logo
 * nobody is maintaining.
 *
 * Honours Reduce Motion. Someone who has asked their phone to stop
 * animating things has asked for a reason, and they get the finished
 * mark, held still — never a half-assembled one.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { color, spacing } from '@loane/shared';
import { markPieces } from './Logo';
import { Text } from './Text';

/**
 * One full cycle: apart, together, butter, hold, fade.
 *
 * Deliberately unhurried. A fast loop reads as anxious, and this is a
 * brand mark before it is a progress indicator.
 */
const CYCLE_MS = 2200;

/** How far out each circle starts, as a fraction of its diameter. */
const START_APART = 0.45;

/**
 * The cycle, as fractions of CYCLE_MS.
 *
 * `fadeIn` has to be non-zero: the loop restarts by jumping the value
 * back to 0, and without a ramp at both ends that jump is a visible
 * flick at the seam.
 */
const PHASE = {
  fadeIn: 0.08,
  closed: 0.5,
  butter: 0.68,
  fadeOut: 0.86,
};

interface Props {
  /** Diameter of one circle, in points. */
  size?: number;
  /** A line under the mark. Say what is happening, not "Loading". */
  label?: string;
  /** Fills its parent and centres itself. For a whole screen. */
  fullScreen?: boolean;
}

export function LoaneLoader({ size = 44, label, fullScreen = false }: Props) {
  const p = markPieces(size);
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    progress.value = 0;
    progress.value = withRepeat(
      // Linear: every phase below is already shaped by where its
      // keyframes sit, and easing the whole cycle on top of that makes
      // the slide arrive twice.
      withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
      -1,
      false,
    );

    // Without this the animation keeps running against an unmounted
    // view, which reanimated warns about and which quietly burns a
    // frame callback for the life of the session.
    return () => cancelAnimation(progress);
  }, [reduceMotion, progress]);

  const apart = size * START_APART;

  /** The whole mark fading in at the start of a cycle and out at the end. */
  const fade = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? 1
      : interpolate(progress.value, [0, PHASE.fadeIn, PHASE.fadeOut, 1], [0, 1, 1, 0]),
  }));

  /**
   * The two halves coming in. Written out twice rather than through a
   * helper, because a hook called from a helper is a hooks-rules
   * violation waiting to be moved behind an `if`.
   */
  const leftSlide = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: reduceMotion
          ? 0
          : interpolate(progress.value, [PHASE.fadeIn, PHASE.closed], [-apart, 0], 'clamp'),
      },
    ],
  }));

  const rightSlide = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: reduceMotion
          ? 0
          : interpolate(progress.value, [PHASE.fadeIn, PHASE.closed], [apart, 0], 'clamp'),
      },
    ],
  }));

  const lens = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? 1
      : interpolate(progress.value, [PHASE.closed, PHASE.butter], [0, 1], 'clamp'),
  }));

  return (
    <View
      style={[styles.wrap, fullScreen && styles.fullScreen]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      {/* Paint order matters and is the same as the static mark's:
          fills, then the lens, then BOTH rings on top. */}
      <Animated.View style={[p.wrap, fade]}>
        <Animated.View style={[p.leftFill, leftSlide]} />
        <Animated.View style={[p.rightFill, rightSlide]} />
        <Animated.View style={[p.lensClip, lens]}>
          <View style={p.lensCircle} />
        </Animated.View>
        <Animated.View style={[p.leftRing, leftSlide]} />
        <Animated.View style={[p.rightRing, rightSlide]} />
      </Animated.View>
      {label ? (
        <Text variant="bodySmall" tone="secondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  fullScreen: { flex: 1, backgroundColor: color.surface.page },
  label: { marginTop: spacing.md, textAlign: 'center' },
});
