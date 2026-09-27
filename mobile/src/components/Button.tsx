/**
 * The bold black primary button from the mockups, plus its outline and text
 * variants. Small uppercase letter-spaced label, square corners.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '@loane/shared';

type Variant = 'primary' | 'outline' | 'text';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        variant === 'text' && styles.textOnly,
        inactive && (variant === 'primary' ? styles.primaryDisabled : styles.disabled),
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.black} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' ? styles.labelOnDark : styles.labelOnLight,
            inactive && styles.labelDisabled,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
  },
  primary: { backgroundColor: colors.black },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.black,
  },
  textOnly: { height: 40, backgroundColor: 'transparent' },
  primaryDisabled: { backgroundColor: colors.disabled },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  label: {
    fontSize: typography.button.size,
    fontWeight: '600',
    letterSpacing: typography.button.letterSpacing,
    textTransform: 'uppercase',
  },
  labelOnDark: { color: colors.white },
  labelOnLight: { color: colors.black },
  labelDisabled: { color: colors.disabledText },
});
