/**
 * A small single-line rounded filter chip, e.g. the occasion row on
 * Discover.
 *
 * Height is fixed from the shared tokens. Its container must not let it
 * stretch — a horizontal ScrollView inside a flex column will pull children
 * to full height unless the ScrollView has `flexGrow: 0`, which is what
 * turned these into tall pills before.
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import {
  color,
  controls,
  radius,
  spacing,
  type,
} from '@loane/shared';

interface Props {
  label: string;
  active?: boolean;
  onPress: () => void;
}

export function Chip({ label, active = false, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: controls.chipHeight,
    // Never let a flex parent stretch the chip vertically.
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  chipActive: { backgroundColor: color.accent.background, borderColor: color.accent.border },
  text: { fontSize: type.bodySmall.size, color: color.text.primary },
  textActive: { color: color.accent.label },
});
