/**
 * Discover — the marketplace. Browse and filter every closet on campus.
 *
 * Phase 0: the Explore / Following tabs, the occasion chips and the empty
 * state. Real browsing and filtering is Phase 2.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OCCASIONS, OCCASION_LABELS, colors, spacing, typography } from '@loane/shared';
import { EmptyState } from '../../src/components/EmptyState';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';

export default function Discover() {
  const [tab, setTab] = useState<'explore' | 'following'>('explore');
  const [occasion, setOccasion] = useState<string | null>(null);

  return (
    <Screen flush>
      <View style={styles.header}>
        <Logo size={26} showWordmark={false} />
        <Text style={styles.title}>Discover</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {OCCASIONS.map((value) => {
          const active = occasion === value;
          return (
            <Pressable
              key={value}
              onPress={() => setOccasion(active ? null : value)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {OCCASION_LABELS[value]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.tabRow}>
        {(['explore', 'following'] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
          >
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value}</Text>
          </Pressable>
        ))}
      </View>

      {/* TODO-PHASE2: search, filters and the listing grid. */}
      <EmptyState
        title="Nothing here yet"
        body={
          tab === 'following'
            ? "Follow a few closets and their pieces will show up here."
            : 'Closets on your campus will show up here as students list their pieces.'
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  headerSpacer: { width: 26 },
  title: {
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  chipRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.black, borderColor: colors.black },
  chipText: { fontSize: 12, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 1, borderBottomColor: colors.black },
  tabText: {
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  tabTextActive: { color: colors.textPrimary },
});
