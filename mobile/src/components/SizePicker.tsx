/**
 * One row of size chips, e.g. "Tops: XS S M L XL".
 *
 * Shared by Edit Profile and the "Get started" size step, so the two
 * can never disagree about how a size is picked. Tapping the selected
 * size clears it — every size is optional.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { controls, fonts, color, spacing, type } from '@loane/shared';
import { Chip } from './Chip';

interface Props {
  label: string;
  options: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
}

export function SizePicker({ label, options, value, onChange }: Props) {
  return (
    <View style={styles.group}>
      <Text maxFontSizeMultiplier={controls.maxFontScale} style={styles.label}>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
      >
        {options.map((option) => (
          <Chip
            key={option}
            label={option}
            active={value === option}
            onPress={() => onChange(value === option ? null : option)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing.lg },
  label: {
    fontFamily: fonts.body,
    fontSize: type.bodySmall.size,
    color: color.text.secondary,
    marginBottom: spacing.sm,
  },
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { gap: spacing.sm, alignItems: 'center', paddingRight: spacing.md },
});
