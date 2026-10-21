/**
 * Swipe a row to the left to reveal buttons behind it — the Instagram
 * and Mail gesture, used on inbox threads for Mute and Delete.
 *
 * Drag past halfway and it stays open; less and it springs shut.
 * Tapping a button closes the row and runs it. Like SwipeToReply it only
 * listens for a sideways drag, so scrolling the list is untouched, and
 * every action is also offered on long-press and to VoiceOver by the
 * row itself, so nothing depends on discovering a swipe.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, controls, iconSize, spacing } from '@loane/shared';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** Width of one button behind the row. */
const ACTION_WIDTH = 84;

export interface SwipeAction {
  label: string;
  icon: IconName;
  /** `danger` for something she may regret, like Delete. */
  tone: 'neutral' | 'danger';
  onPress: () => void;
}

interface Props {
  actions: SwipeAction[];
  children: ReactNode;
}

export function SwipeActions({ actions, children }: Props) {
  const width = ACTION_WIDTH * actions.length;
  const offset = useSharedValue(0);
  const start = useSharedValue(0);

  const close = () => {
    offset.value = withTiming(0, { duration: 160 });
  };

  const pan = Gesture.Pan()
    // A sideways drag of 12pt starts it; vertical movement first hands
    // the touch back to the list so it scrolls.
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
      start.value = offset.value;
    })
    .onUpdate((e) => {
      offset.value = Math.min(0, Math.max(-width, start.value + e.translationX));
    })
    .onEnd(() => {
      const open = offset.value < -width / 2;
      offset.value = withTiming(open ? -width : 0, { duration: 160 });
    });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  const run = (action: SwipeAction) => {
    close();
    action.onPress();
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.actions, { width }]}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => run(action)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={[styles.action, action.tone === 'danger' ? styles.danger : styles.neutral]}
          >
            <Icon name={action.icon} size={iconSize.sm} tint={color.icon.inverse} />
            <Text variant="caption" tone="inverse">
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, row]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  action: {
    width: ACTION_WIDTH,
    minHeight: controls.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  neutral: { backgroundColor: color.button.dark.background },
  danger: { backgroundColor: color.status.error },
  // The row must be opaque, or the buttons show through it at rest.
  row: { backgroundColor: color.surface.page },
});
