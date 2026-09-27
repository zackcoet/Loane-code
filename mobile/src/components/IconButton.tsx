/**
 * An icon with a guaranteed 44x44pt tap target.
 *
 * Apple's minimum is 44pt square. Most of our glyphs are smaller than that,
 * so the button reserves the full target and centres the glyph inside it.
 * Using this everywhere is why the header icons are actually hittable.
 */

import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import {
  color,
  controls,
  iconSize,
} from '@loane/shared';
import { Icon, type IconName } from './Icon';

interface Props {
  name: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  /** Overrides the default glyph colour. */
  tint?: string;
  style?: ViewStyle;
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  size = iconSize.md,
  tint = color.icon.default,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.target, pressed && styles.pressed, style]}
    >
      <Icon name={name} size={size} tint={tint} />
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
});
