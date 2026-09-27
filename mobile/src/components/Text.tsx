/**
 * Every piece of text in the app.
 *
 * Using this instead of React Native's own `<Text>` is what stops a screen
 * inventing a font size. You pick a role — `body`, `label`, `h2` — and the
 * size, line height, weight and letter spacing all come from the tokens.
 *
 * If a variant you need does not exist, add it to `type` in tokens.ts rather
 * than passing a style override.
 */

import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { color, type } from '@loane/shared';

export type TextVariant = keyof typeof type;
export type TextTone = 'primary' | 'secondary' | 'muted' | 'inverse' | 'error';

interface Props extends TextProps {
  /** Named text role from the type scale. */
  variant?: TextVariant;
  tone?: TextTone;
  /** Uppercase with letter spacing. On by default for label and caption. */
  uppercase?: boolean;
  children?: React.ReactNode;
}

const TONE: Record<TextTone, string> = {
  primary: color.text.primary,
  secondary: color.text.secondary,
  muted: color.text.muted,
  inverse: color.text.inverse,
  error: color.text.error,
};

export function Text({
  variant = 'body',
  tone = 'primary',
  uppercase,
  style,
  children,
  ...rest
}: Props) {
  const spec = type[variant];
  const isLabelish = variant === 'label' || variant === 'caption';
  const upper = uppercase ?? isLabelish;

  return (
    <RNText
      {...rest}
      style={[
        {
          fontSize: spec.size,
          lineHeight: spec.lineHeight,
          fontWeight: spec.weight,
          color: TONE[tone],
          letterSpacing: 'letterSpacing' in spec ? spec.letterSpacing : undefined,
        },
        upper && styles.upper,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  upper: { textTransform: 'uppercase' },
});
