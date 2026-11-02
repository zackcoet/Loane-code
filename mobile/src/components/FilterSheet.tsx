/**
 * The filter sheet behind Discover's Filter button.
 *
 * Edits a draft copy, so backing out leaves her results untouched. Only
 * "Show results" applies anything.
 *
 * THE BACK ARROW, AND WHY IT TOOK TWO GOES.
 *
 * Ella could open this and not get out. The first fix was right about
 * the cause, and did not work: a React Native Modal gets no safe-area
 * inset of its own, so the header sat under the Dynamic Island and the
 * arrow was off the top of the glass. It wrapped the sheet in
 * SafeAreaView.
 *
 * That was the trap. SafeAreaView from react-native-safe-area-context
 * measures itself inside its own NATIVE view hierarchy, and a Modal is
 * a separate one with no provider in it. Inside a Modal it can report
 * an inset of zero, which puts the header back under the island. The
 * fix looked correct in the diff and changed nothing on a real phone.
 *
 * So the inset is now read in Discover, OUTSIDE the Modal, where it is
 * known good, and passed in as a plain number. Padding from a number
 * cannot be zeroed by a context that is not there.
 */

import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
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
import { useKeyboardPadding } from '../hooks/useKeyboardPadding';

interface Props {
  visible: boolean;
  filters: Filters;
  /**
   * The top safe-area inset, measured by Discover. See the note above:
   * this cannot be measured from in here.
   */
  topInset: number;
  /** How many listings the draft would show, so she can see it narrowing. */
  resultCount: number;
  onPreview: (filters: Filters) => void;
  onApply: (filters: Filters) => void;
  onClose: () => void;
}

export function FilterSheet({
  visible,
  filters,
  topInset,
  resultCount,
  onPreview,
  onApply,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<Filters>(filters);
  const keyboardPadding = useKeyboardPadding();

  /*
    START FROM WHAT IS ACTUALLY APPLIED, every time it opens.

    A Modal's children stay mounted when it is hidden, so `draft` kept
    whatever she had been editing when she backed out. Reopening showed
    chips selected that were never applied, which makes "back leaves
    your results untouched" a lie the second time you look at it.
  */
  useEffect(() => {
    if (visible) setDraft(filters);
    // Only when it opens. Following `filters` as well would reset her
    // edits underneath her, because onPreview changes it as she taps.
  }, [visible]);

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
      <View style={[styles.sheet, { paddingTop: topInset }]}>
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

        <ScrollView
          contentContainerStyle={[
            styles.content,
            keyboardPadding > 0 && { paddingBottom: keyboardPadding },
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
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

        <View style={[styles.footer, keyboardPadding > 0 && { paddingBottom: keyboardPadding }]}>
          <Button
            label={resultCount === 1 ? 'Show 1 piece' : `Show ${resultCount} pieces`}
            onPress={() => onApply(draft)}
          />
        </View>
      </View>
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
