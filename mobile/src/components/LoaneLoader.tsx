/**
 * The Loane mark, turning slowly. Our loading indicator.
 *
 * ONE component for every full-screen wait — launch, sign-up, uploading a
 * post or a listing, and payment once that lands. A spinning platform
 * `ActivityIndicator` says "an app is thinking". The rings say "Loane is
 * thinking", and a wait is one of the few moments a user is definitely
 * looking at the screen.
 *
 * The rings only. No letters: at loader size the five letterforms turn
 * into a smear, and a rotating wordmark reads as broken rather than busy.
 *
 * Honours Reduce Motion. Someone who has asked their phone to stop
 * animating things has asked for a reason, and a slowly rotating logo is
 * exactly the kind of thing that setting exists for — they get the mark,
 * held still.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { Logo } from './Logo';
import { Text } from './Text';

/**
 * One turn takes this long.
 *
 * Deliberately slow. A fast spin reads as anxious, and these rings are a
 * brand mark before they are a progress indicator.
 */
const ROTATION_MS = 2600;

interface Props {
  /** Diameter of one ring, in points. */
  size?: number;
  /** A line under the mark. Say what is happening, not "Loading". */
  label?: string;
  /** Fills its parent and centres itself. For a whole screen. */
  fullScreen?: boolean;
  tint?: string;
}

export function LoaneLoader({
  size = 44,
  label,
  fullScreen = false,
  tint = color.icon.default,
}: Props) {
  const spin = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    spin.value = 0;
    spin.value = withRepeat(
      withTiming(360, { duration: ROTATION_MS, easing: Easing.linear }),
      // -1 is "forever". Linear easing matters: an ease-in-out loop
      // visibly stutters at the seam where each turn restarts.
      -1,
      false,
    );

    // Without this the animation keeps running against an unmounted
    // view, which reanimated warns about and which quietly burns a
    // frame callback for the life of the session.
    return () => cancelAnimation(spin);
  }, [reduceMotion, spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  return (
    <View
      style={[styles.wrap, fullScreen && styles.fullScreen]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <Animated.View style={style}>
        <Logo size={size} lockup="mark" tint={tint} />
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
