/**
 * The underlined text input from the mockups — no box, just a hairline
 * under the text, with the error message in place of the line when
 * something is wrong.
 */

import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import {
  color,
  controls,
  spacing,
  type,
} from '@loane/shared';

interface Props extends TextInputProps {
  error?: string | null;
  /** Small uppercase label above the field. */
  label?: string;
  hint?: string;
}

export function Input({ error, label, hint, style, ...inputProps }: Props) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={color.text.muted}
        {...inputProps}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: {
    fontSize: type.label.size,
    letterSpacing: type.label.letterSpacing,
    textTransform: 'uppercase',
    color: color.text.secondary,
    marginBottom: spacing.sm,
  },
  input: {
    height: controls.inputHeight,
    fontSize: type.body.size,
    color: color.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: color.border.default,
    paddingVertical: spacing.sm,
  },
  inputError: { borderBottomColor: color.status.error },
  error: { marginTop: spacing.sm, fontSize: type.bodySmall.size, color: color.status.error },
  hint: { marginTop: spacing.sm, fontSize: type.bodySmall.size, color: color.text.muted },
});
