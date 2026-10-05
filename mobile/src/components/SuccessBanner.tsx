/**
 * A chartreuse banner that slides in from the top and leaves on its own.
 *
 * Loane's success moments used to be `Alert.alert`, which is a native
 * iOS dialog: it cannot be branded, it blocks the screen, and it makes
 * you tap OK to acknowledge good news. "Look shared" does not need
 * acknowledging.
 *
 * Mounted once at the root, shown from anywhere through `useSuccessBanner`,
 * so it survives the navigation that usually follows a success — share a
 * look and the banner is still there over the post it took you to.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { color, radius, spacing } from '@loane/shared';
import { Icon } from './Icon';
import { Text } from './Text';

/** Long enough to read a short line, short enough not to be in the way. */
const VISIBLE_MS = 2600;

interface BannerState {
  show: (message: string) => void;
}

const SuccessBannerContext = createContext<BannerState | null>(null);

export function SuccessBannerProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((next: string) => setMessage(next), []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), VISIBLE_MS);
    // Showing a second banner restarts the clock rather than letting the
    // first one's timer cut the second one short.
    return () => clearTimeout(timer);
  }, [message]);

  const value = useMemo<BannerState>(() => ({ show }), [show]);

  return (
    <SuccessBannerContext.Provider value={value}>
      {children}
      {message ? (
        <Animated.View
          entering={FadeInUp.duration(220)}
          exiting={FadeOutUp.duration(180)}
          style={[styles.banner, { top: insets.top + spacing.sm }]}
          pointerEvents="none"
          accessibilityRole="alert"
        >
          <Icon name="checkmark" size={18} tint={color.accent.label} />
          <Text variant="bodySmall" style={styles.text} uppercase={false}>
            {message}
          </Text>
        </Animated.View>
      ) : null}
    </SuccessBannerContext.Provider>
  );
}

export function useSuccessBanner(): BannerState {
  const value = useContext(SuccessBannerContext);
  if (!value) throw new Error('useSuccessBanner must be used inside SuccessBannerProvider');
  return value;
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: color.accent.background,
  },
  text: { color: color.accent.label, fontWeight: '600', flex: 1 },
});
