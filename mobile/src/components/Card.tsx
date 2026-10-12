/**
 * A white block that lifts off the page.
 *
 * Used all over the mockups for settings rows, safety tips, stat panels
 * and sheet options. Square corners, because that is the look.
 *
 * It carries a very soft shadow as well as the hairline. A white card on
 * a cream page did not need one; on a white page it does, or the card
 * and the page are the same surface and the border is doing all the
 * work. Deliberately barely there — anything heavier and the app looks
 * like a dashboard rather than a magazine.
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
    shadowColor: color.shadow.card,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    // Android ignores shadow* entirely and needs this instead.
    elevation: 1,
  },
  padded: { padding: spacing.md },
  tappable: { minHeight: controls.minTapTarget },
  pressed: { backgroundColor: color.surface.muted },
});
