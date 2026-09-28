/**
 * The campus selector in the feed header.
 *
 * Shows the student's actual school name with a small dot in the school's
 * color — the color only, never the university's logo, which is trademarked.
 * Both come from the `campuses` document, so a new school needs no code
 * change.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  color,
  controls,
  radius,
  spacing,
  type,
} from '@loane/shared';
import { useCampus } from '../hooks/useCampus';
import { Icon } from './Icon';

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
      <Icon name="chevron-down" size={14} tint={color.text.secondary} />
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
    borderColor: color.border.default,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '82%',
  },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: spacing.sm },
  text: {
    flexShrink: 1,
    fontSize: type.bodySmall.size,
    color: color.text.primary,
  },
  chevron: { marginLeft: spacing.sm, fontSize: type.caption.size, color: color.text.secondary },
});
