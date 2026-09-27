/**
 * The underlined text input from the mockups — no box, just a hairline
 * under the text, with the error message in place of the line when
 * something is wrong.
 */

import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, spacing, typography } from '@loane/shared';

interface Props extends TextInputProps {
  error?: string | null;
  /** Small uppercase label above the field. */
  label?: string;
  hint?: string;
}

export function Field({ error, label, hint, style, ...inputProps }: Props) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
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
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    height: 44,
    fontSize: typography.body.size,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  inputError: { borderBottomColor: colors.danger },
  error: { marginTop: spacing.sm, fontSize: 12, color: colors.danger },
  hint: { marginTop: spacing.sm, fontSize: 12, color: colors.textMuted },
});
