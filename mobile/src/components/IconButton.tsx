/**
 * An icon with a guaranteed 44x44pt tap target.
 *
 * Apple's minimum is 44pt square. Most of our glyphs are smaller than that,
 * so the button reserves the full target and centres the glyph inside it.
 * Using this everywhere is why the header icons are actually hittable.
 */

import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { color, controls, iconSize, radius } from '@loane/shared';
import { Icon, type IconName } from './Icon';

interface Props {
  name: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  /** Overrides the default glyph colour. */
  tint?: string;
  /**
   * Fills the tap target with a chartreuse circle.
   *
   * For the one icon on a screen that CREATES something — the + that
   * opens "Post a Look / Add to My Closet". A header full of outline
   * glyphs gives no clue which one makes a thing, and that is the tap
   * Loane most wants.
   */
  accent?: boolean;
  style?: ViewStyle;
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  size = iconSize.md,
  tint,
  accent = false,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.target,
        accent && styles.accent,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Icon
        name={name}
        size={size}
        tint={tint ?? (accent ? color.accent.label : color.icon.default)}
      />
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
  // Inset so the circle is a comfortable 36pt inside the 44pt target,
  // rather than a disc that touches its neighbours.
  accent: {
    backgroundColor: color.accent.background,
    borderRadius: radius.pill,
    margin: 4,
    width: controls.minTapTarget - 8,
    height: controls.minTapTarget - 8,
  },
  pressed: { opacity: 0.5 },
});
