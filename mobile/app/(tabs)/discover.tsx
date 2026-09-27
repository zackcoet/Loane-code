/**
 * Discover — the marketplace. Browse and filter every closet on campus.
 *
 * Listings come live from Firestore, scoped to her campus and to active
 * status. Search and the occasion chips filter what has already loaded;
 * server-side search and the full filter/sort sheets are Phase 2.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  OCCASIONS,
  OCCASION_LABELS,
  colors,
  controls,
  radii,
  spacing,
  typography,
  type Occasion,
} from '@loane/shared';
import { Chip } from '../../src/components/Chip';
import { EmptyState } from '../../src/components/EmptyState';
import { ListingCard } from '../../src/components/ListingCard';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';
import { useListings } from '../../src/hooks/useFeed';
import { logEvent } from '../../src/analytics/events';

const GRID_COLUMNS = 2;

export default function Discover() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { items: listings, loading, error } = useListings();

  const [tab, setTab] = useState<'explore' | 'following'>('explore');
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [search, setSearch] = useState('');

  const cardWidth = useMemo(() => {
    const gutters = spacing.md * 2 + spacing.md * (GRID_COLUMNS - 1);
    return (width - gutters) / GRID_COLUMNS;
  }, [width]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return listings.filter((listing) => {
      if (occasion && !listing.occasions.includes(occasion)) return false;
      if (!term) return true;
      return (
        listing.name.toLowerCase().includes(term) ||
        (listing.brand ?? '').toLowerCase().includes(term) ||
        listing.owner.username.toLowerCase().includes(term)
      );
    });
  }, [listings, occasion, search]);

  return (
    <Screen flush>
      <View style={styles.header}>
        <Logo size={30} lockup="mark" />
        <Text style={styles.title}>Discover</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            if (value.trim().length > 2) {
              logEvent('search', { surface: 'discover', meta: { length: value.trim().length } });
            }
          }}
          placeholder="Search closets and pieces"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {search.length > 0 ? (
          <Pressable
            onPress={() => setSearch('')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* All eight occasions, in one scrolling row of single-line chips. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // flexGrow: 0 stops the flex column stretching the row to full
        // height, which is what turned these into tall pills.
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {OCCASIONS.map((value) => (
          <Chip
            key={value}
            label={OCCASION_LABELS[value]}
            active={occasion === value}
            onPress={() => {
              const next = occasion === value ? null : value;
              setOccasion(next);
              if (next) {
                logEvent('filter_used', { surface: 'discover', meta: { occasion: next } });
              }
            }}
          />
        ))}
      </ScrollView>

      {/* TODO-PHASE2: these open the real filter and sort sheets. */}
      <View style={styles.toolRow}>
        <Pressable style={styles.toolButton} accessibilityRole="button">
          <Text style={styles.toolGlyph}>⚟</Text>
          <Text style={styles.toolLabel}>Filter</Text>
        </Pressable>
        <Pressable style={styles.toolButton} accessibilityRole="button">
          <Text style={styles.toolGlyph}>⇅</Text>
          <Text style={styles.toolLabel}>Sort</Text>
        </Pressable>
      </View>

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

      {tab === 'following' ? (
        // TODO-PHASE3: filter by who she follows.
        <EmptyState
          title="Nothing here yet"
          body="Follow a few closets and their pieces will show up here."
        />
      ) : loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.black} />
        </View>
      ) : error ? (
        <EmptyState title="Couldn't load Discover" body={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={
            search || occasion
              ? 'Try a different search or occasion.'
              : 'Closets on your campus will show up here as students list their pieces.'
          }
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(listing) => listing.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              width={cardWidth}
              onPressOwner={(username) => router.push(`/u/${username}`)}
              onPress={(listingId) => {
                logEvent('listing_view', {
                  surface: 'discover',
                  targetType: 'listing',
                  targetId: listingId,
                });
                // TODO-PHASE2: open the listing detail screen.
                router.push('/(tabs)/discover');
              }}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: controls.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  headerSpacer: { width: 46 },
  title: {
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: controls.minTapTarget,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
  },
  searchGlyph: { fontSize: 20, color: colors.textMuted, marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    fontSize: typography.bodySmall.size,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  clear: { fontSize: 16, color: colors.textMuted, paddingLeft: spacing.sm },
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: controls.minTapTarget,
    minWidth: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  toolGlyph: { fontSize: 15, color: colors.textPrimary, marginRight: spacing.sm },
  toolLabel: {
    fontSize: typography.caption.size,
    letterSpacing: typography.caption.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.black },
  tabText: {
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  tabTextActive: { color: colors.textPrimary },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  gridRow: { gap: spacing.md },
});
