/**
 * A hairline-bordered block — the container used all over the mockups for
 * settings rows, safety tips, stat panels and sheet options.
 *
 * Square corners by default, because that is the look: thin borders, lots
 * of white space, no rounding.
 */

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, controls, spacing } from '@loane/shared';

interface Props {
  children: React.ReactNode;
  /** Makes the whole card tappable, with a 44pt minimum height. */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Removes the inner padding, for a card that holds an image. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, onPress, accessibilityLabel, flush, style }: Props) {
  const base = [styles.card, flush ? null : styles.padded, style];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, styles.tappable, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.surface.raised,
  },
  padded: { padding: spacing.md },
  tappable: { minHeight: controls.minTapTarget },
  pressed: { backgroundColor: color.surface.muted },
});
