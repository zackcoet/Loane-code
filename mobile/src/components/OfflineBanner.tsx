/**
 * "No internet connection" — a small bar while the phone is offline.
 *
 * Floats near the bottom, above the tab bar, like Instagram's. It
 * never takes taps (pointerEvents none), so nothing underneath it stops
 * working. Without it, a list that could not load looks like an empty
 * list, and a save that is waiting for signal looks frozen.
 *
 * Merlot, not cherry: being offline is information, not something to
 * tap.
 */

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, controls, iconSize, spacing } from '@loane/shared';
import { Icon } from './Icon';
import { Text } from './Text';
import { useIsOffline } from '../network/connection';

/** Clears a standard tab bar so the bar never sits on the tabs. */
const ABOVE_TAB_BAR = controls.minTapTarget + spacing.lg;

export function OfflineBanner() {
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();
  if (!offline) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + ABOVE_TAB_BAR }]}>
      <View
        style={styles.bar}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Icon name="cloud-offline-outline" size={iconSize.sm} tint={color.icon.inverse} />
        <Text variant="bodySmall" tone="inverse">
          No internet connection
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: color.surface.inverse,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
