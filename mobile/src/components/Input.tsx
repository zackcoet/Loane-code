/**
 * The underlined text input from the mockups — no box, just a hairline
 * under the text, with the error message in place of the line when
 * something is wrong.
 */

import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { fontFamilyFor, color, controls, spacing, type, fonts } from '@loane/shared';

interface Props extends TextInputProps {
  error?: string | null;
  /** Small uppercase label above the field. */
  label?: string;
  hint?: string;
}

export function Input({ error, label, hint, style, ...inputProps }: Props) {
  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text maxFontSizeMultiplier={controls.maxFontScale} style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        maxFontSizeMultiplier={controls.maxFontScale}
        placeholderTextColor={color.text.muted}
        // The label above is a separate Text, so VoiceOver would read only
        // the placeholder. Name the field after its label, and read the
        // error (or the hint) after it.
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        {...inputProps}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {error ? (
        <Text maxFontSizeMultiplier={controls.maxFontScale} style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text maxFontSizeMultiplier={controls.maxFontScale} style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: {
    fontFamily: fontFamilyFor('500'),
    fontSize: type.label.size,
    letterSpacing: type.label.letterSpacing,
    textTransform: 'uppercase',
    color: color.text.secondary,
    marginBottom: spacing.sm,
  },
  input: {
    fontFamily: fonts.body,
    // minHeight so a larger text size grows the field instead of clipping.
    minHeight: controls.inputHeight,
    fontSize: type.body.size,
    color: color.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: color.border.default,
    paddingVertical: spacing.sm,
  },
  inputError: { borderBottomColor: color.status.error },
  error: {
    fontFamily: fonts.body,
    marginTop: spacing.sm,
    fontSize: type.bodySmall.size,
    color: color.status.error,
  },
  hint: {
    fontFamily: fonts.body,
    marginTop: spacing.sm,
    fontSize: type.bodySmall.size,
    color: color.text.muted,
  },
});
