/**
 * The bold black primary button from the mockups, plus its outline and text
 * variants. Small uppercase letter-spaced label, square corners.
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

type Variant = 'primary' | 'outline' | 'text';
type Tone = 'default' | 'accent';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  tone?: Tone;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  tone = 'default',
  disabled = false,
  loading = false,
  style,
}: Props) {
  const inactive = disabled || loading;
  const accent = variant === 'primary' && tone === 'accent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && (accent ? styles.primaryAccent : styles.primary),
        variant === 'outline' && styles.outline,
        variant === 'text' && styles.textOnly,
        inactive && (variant === 'primary' ? styles.primaryDisabled : styles.disabled),
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            accent
              ? color.accent.label
              : variant === 'primary'
                ? color.surface.page
                : color.icon.default
          }
        />
      ) : (
        <Text
          style={[
            styles.label,
            accent
              ? styles.labelAccent
              : variant === 'primary'
                ? styles.labelOnDark
                : styles.labelOnLight,
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
    height: controls.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
  },
  primary: { backgroundColor: color.surface.inverse },
  primaryAccent: { backgroundColor: color.button.accent.background },
  outline: {
    backgroundColor: color.surface.page,
    borderWidth: 1,
    borderColor: color.border.inverse,
  },
  textOnly: { height: controls.minTapTarget, backgroundColor: 'transparent' },
  primaryDisabled: { backgroundColor: color.surface.disabled },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  label: {
    fontSize: type.button.size,
    fontWeight: '600',
    letterSpacing: type.button.letterSpacing,
    textTransform: 'uppercase',
  },
  labelOnDark: { color: color.text.inverse },
  labelOnLight: { color: color.icon.default },
  labelAccent: { color: color.button.accent.label },
  labelDisabled: { color: color.text.disabled },
});
