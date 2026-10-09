/**
 * The filter sheet behind Discover's Filter button.
 *
 * Edits a draft copy, so backing out leaves her results untouched — only
 * "Show results" applies anything.
 */

import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  OCCASIONS,
  OCCASION_LABELS,
  SIZES,
  color,
  controls,
  spacing,
  type Category,
  type Occasion,
  type Size,
} from '@loane/shared';
import { Button } from './Button';
import { Chip } from './Chip';
import { Header } from './Header';
import { Input } from './Input';
import { Text } from './Text';
import { Toggle } from './Toggle';
import { EMPTY_FILTERS, countActiveFilters, type Filters } from '../hooks/useDiscover';

interface Props {
  visible: boolean;
  filters: Filters;
  /** How many listings the draft would show, so she can see it narrowing. */
  resultCount: number;
  onPreview: (filters: Filters) => void;
  onApply: (filters: Filters) => void;
  onClose: () => void;
}

export function FilterSheet({ visible, filters, resultCount, onPreview, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<Filters>(filters);

  const update = (next: Filters) => {
    setDraft(next);
    onPreview(next);
  };

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* A Modal gets no safe-area inset of its own, and this sheet was
          a plain View — so on a notched iPhone the header sat UNDER the
          Dynamic Island and the back arrow could not be tapped at all.
          Every other screen goes through Screen, which handles this.
          The button was never broken; it was off the top of the glass. */}
      <SafeAreaView style={styles.sheet} edges={['top', 'left', 'right']}>
        <Header
          title="Filter"
          onBack={onClose}
          right={
            countActiveFilters(draft) > 0 ? (
              <Text
                variant="bodySmall"
                onPress={() => update(EMPTY_FILTERS)}
                accessibilityRole="button"
                style={styles.clear}
              >
                Clear
              </Text>
            ) : null
          }
        />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="label">Size</Text>
          <View style={styles.row}>
            {SIZES.map((value) => (
              <Chip
                key={value}
                label={value}
                active={draft.sizes.includes(value)}
                onPress={() => update({ ...draft, sizes: toggle<Size>(draft.sizes, value) })}
              />
            ))}
          </View>

          <Text variant="label" style={styles.section}>
            Category
          </Text>
          <View style={styles.row}>
            {CATEGORIES.map((value) => (
              <Chip
                key={value}
                label={CATEGORY_LABELS[value]}
                active={draft.categories.includes(value)}
                onPress={() =>
                  update({ ...draft, categories: toggle<Category>(draft.categories, value) })
                }
              />
            ))}
          </View>

          <Text variant="label" style={styles.section}>
            Occasion
          </Text>
          <View style={styles.row}>
            {OCCASIONS.map((value) => (
              <Chip
                key={value}
                label={OCCASION_LABELS[value]}
                active={draft.occasions.includes(value)}
                onPress={() =>
                  update({ ...draft, occasions: toggle<Occasion>(draft.occasions, value) })
                }
              />
            ))}
          </View>

          <Text variant="label" style={styles.section}>
            Price
          </Text>
          <Text variant="bodySmall" tone="muted" style={styles.hint}>
            Rental price for 3 days, or the sale price for buy-only pieces.
          </Text>
          <View style={styles.priceRow}>
            <Input
              label="Min"
              value={draft.minPrice}
              onChangeText={(v) => update({ ...draft, minPrice: v })}
              placeholder="$0"
              keyboardType="decimal-pad"
              style={styles.priceInput}
            />
            <Input
              label="Max"
              value={draft.maxPrice}
              onChangeText={(v) => update({ ...draft, maxPrice: v })}
              placeholder="Any"
              keyboardType="decimal-pad"
              style={styles.priceInput}
            />
          </View>

          <Toggle
            label="Available now only"
            help="Hide pieces their owner has paused."
            value={draft.availableOnly}
            onValueChange={(v) => update({ ...draft, availableOnly: v })}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={resultCount === 1 ? 'Show 1 piece' : `Show ${resultCount} pieces`}
            onPress={() => onApply(draft)}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: color.surface.page },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  section: { marginTop: spacing.lg },
  hint: { marginTop: spacing.xs },
  priceRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  priceInput: { minWidth: 0 },
  clear: { textDecorationLine: 'underline' },
  footer: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    minHeight: controls.minTapTarget,
  },
});
