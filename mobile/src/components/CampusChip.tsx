/**
 * The campus selector in the feed header.
 *
 * Shows the student's actual school name with a small dot in the school's
 * color — the color only, never the university's logo, which is trademarked.
 * Both come from the `campuses` document, so a new school needs no code
 * change.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, controls, radii, spacing, typography } from '@loane/shared';
import { useCampus } from '../hooks/useCampus';

export function CampusChip({ onPress }: { onPress?: () => void }) {
  const { name, dotColor } = useCampus();

  return (
    <Pressable
      style={styles.chip}
      accessibilityRole="button"
      accessibilityLabel={`Campus: ${name}`}
      onPress={onPress}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.chevron}>⌄</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: controls.minTapTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '82%',
  },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: spacing.sm },
  text: {
    flexShrink: 1,
    fontSize: typography.bodySmall.size,
    color: colors.textPrimary,
  },
  chevron: { marginLeft: spacing.sm, fontSize: 14, color: colors.textSecondary },
});
