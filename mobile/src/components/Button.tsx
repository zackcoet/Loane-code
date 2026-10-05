/**
 * Loane's button. Small uppercase letter-spaced label, square corners.
 *
 * The primary action is CHARTREUSE with a black label, because the
 * primary action is where the brand should be loudest — "Request to
 * rent", "Publish look", "Continue". Everything else stays black and
 * white so the accent keeps its meaning.
 *
 * `dark` is the same weight in black, for a primary action that should
 * not feel celebratory. Reporting another student is the case that
 * needs it.
 *
 * This replaced a `tone="accent"` prop that had to be remembered at
 * every call site. Making the default carry the brand means a new
 * screen is branded because it exists, not because someone remembered.
 */

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { color, controls, radius, spacing, type } from '@loane/shared';

type Variant = 'primary' | 'dark' | 'outline' | 'text';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: Props) {
  const inactive = disabled || loading;
  // Both filled variants grey out the whole button rather than just
  // fading it, so a disabled primary does not look like a pale brand.
  const filled = variant === 'primary' || variant === 'dark';

  const labelColor = inactive
    ? color.text.disabled
    : variant === 'primary'
      ? color.button.primary.label
      : variant === 'dark'
        ? color.button.dark.label
        : color.icon.default;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'dark' && styles.dark,
        variant === 'outline' && styles.outline,
        variant === 'text' && styles.textOnly,
        inactive && (filled ? styles.filledDisabled : styles.disabled),
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: controls.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
  },
  primary: { backgroundColor: color.button.primary.background },
  dark: { backgroundColor: color.button.dark.background },
  outline: {
    backgroundColor: color.surface.page,
    borderWidth: 1,
    borderColor: color.border.inverse,
  },
  textOnly: { height: controls.minTapTarget, backgroundColor: 'transparent' },
  filledDisabled: { backgroundColor: color.surface.disabled },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  label: {
    fontSize: type.button.size,
    fontWeight: '600',
    letterSpacing: type.button.letterSpacing,
    textTransform: 'uppercase',
  },
});
