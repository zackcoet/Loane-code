/**
 * "You're all caught up" — the line in Following between new looks and
 * older ones (NORTH_STAR D7). Placed by `caughtUpIndex` in
 * shared/src/feedOrder.ts.
 *
 * Honest, not sticky: it tells her she has seen everything new, and
 * anything she keeps scrolling into is labelled as older. No filler.
 */

import { StyleSheet, View } from 'react-native';
import { FEED_RANKING, color, controls, iconSize, radius, spacing } from '@loane/shared';
import { Icon } from './Icon';
import { Text } from './Text';

export function CaughtUpMarker() {
  const days = Math.round(FEED_RANKING.caughtUp.windowHours / 24);
  return (
    <View style={styles.wrap} accessible accessibilityRole="text">
      <View style={styles.badge}>
        <Icon name="checkmark" size={iconSize.sm} tint={color.icon.default} />
      </View>
      <Text variant="body" style={styles.title}>
        You&apos;re all caught up
      </Text>
      <Text variant="caption" tone="muted">
        You&apos;ve seen every new look from the past {days} days.
      </Text>
      <View style={styles.rule} />
      <Text variant="label" tone="muted">
        Older looks
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  badge: {
    width: controls.minTapTarget,
    height: controls.minTapTarget,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { textAlign: 'center' },
  rule: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.border.default,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
