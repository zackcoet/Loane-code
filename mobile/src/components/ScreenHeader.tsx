/**
 * The centered uppercase screen title from the mockups ("ACTIVITY",
 * "MY RENTALS", "POST A LOOK") with an optional back chevron.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@loane/shared';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12}>
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  side: { width: 44, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  chevron: { fontSize: 30, lineHeight: 34, color: colors.black },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  spacer: { width: spacing.md },
});
