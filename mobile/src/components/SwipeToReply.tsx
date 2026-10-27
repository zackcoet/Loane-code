/**
 * Swipe a chat bubble to the right to reply to it — the Instagram and
 * iMessage gesture.
 *
 * The bubble follows her finger a short way, a reply arrow fades in
 * behind it, and letting go past the threshold starts a reply. It only
 * listens for a rightward drag, so scrolling the thread up and down is
 * untouched. Long-press (handled by the bubble) does the same thing for
 * anyone who does not know the gesture, and VoiceOver gets a "Reply"
 * action, so nothing depends on discovering a swipe.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { color, iconSize, spacing } from '@loane/shared';
import { Icon } from './Icon';

/** How far she has to drag before letting go means "reply". */
const THRESHOLD = 56;
/** How far the bubble will follow her finger. */
const MAX_DRAG = 72;

interface Props {
  /** Absent when she can't reply here: the bubble then doesn't move. */
  onReply?: () => void;
  children: ReactNode;
}

const noop = () => undefined;

export function SwipeToReply({ onReply, children }: Props) {
  const offset = useSharedValue(0);
  const reply = onReply ?? noop;

  const pan = Gesture.Pan()
    .enabled(Boolean(onReply))
    // Only a rightward drag of 12pt starts it; any real vertical
    // movement first hands the touch back to the list so it scrolls.
    .activeOffsetX(12)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      offset.value = Math.max(0, Math.min(MAX_DRAG, e.translationX));
    })
    .onEnd(() => {
      if (offset.value >= THRESHOLD) runOnJS(reply)();
      offset.value = withTiming(0, { duration: 160 });
    })
    .onFinalize(() => {
      offset.value = withTiming(0, { duration: 160 });
    });

  const bubble = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));
  const arrow = useAnimatedStyle(() => ({
    opacity: Math.min(1, offset.value / THRESHOLD),
  }));

  return (
    <View>
      <Animated.View style={[styles.arrow, arrow]} pointerEvents="none">
        <Icon name="arrow-undo" size={iconSize.sm} tint={color.icon.muted} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={bubble}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: {
    position: 'absolute',
    left: spacing.xs,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
