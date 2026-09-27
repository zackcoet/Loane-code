/**
 * An icon with a guaranteed 44x44pt tap target.
 *
 * Apple's minimum is 44pt square. Most of our glyphs are smaller than that,
 * so the button reserves the full target and centres the glyph inside it.
 * Using this everywhere is why the header icons are actually hittable.
 */

import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors, controls, icons } from '@loane/shared';

interface Props {
  /** A text glyph, e.g. "≡". */
  glyph: string;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function IconButton({
  glyph,
  onPress,
  accessibilityLabel,
  size = icons.md,
  color = colors.black,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.target, pressed && styles.pressed, style]}
    >
      <Text style={[styles.glyph, { fontSize: size, lineHeight: size * 1.15, color }]}>
        {glyph}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    width: controls.minTapTarget,
    height: controls.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.5 },
  glyph: { textAlign: 'center' },
});
