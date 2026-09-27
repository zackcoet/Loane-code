/**
 * Discover — the marketplace.
 *
 * One query goes to the server (active listings on my campus, newest
 * first) and search, filters and sort all run on the phone. That is a
 * deliberate choice; the reasoning and the point at which we outgrow it
 * are written up in src/hooks/useDiscover.ts and docs/roadmap.md.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  OCCASIONS,
  OCCASION_LABELS,
  color,
  controls,
  radius,
  spacing,
  type,
  type Occasion,
} from '@loane/shared';
import { Chip } from '../../src/components/Chip';
import { EmptyState } from '../../src/components/EmptyState';
import { FilterSheet } from '../../src/components/FilterSheet';
import { ListingCard } from '../../src/components/ListingCard';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useListings } from '../../src/hooks/useFeed';
import { useFollowingUids } from '../../src/hooks/useFollowing';
import { useHiddenUids } from '../../src/hooks/useBlocks';
import {
  EMPTY_FILTERS,
  SORTS,
  SORT_LABELS,
  countActiveFilters,
  useDiscoverResults,
  useDiscoverState,
  type Filters,
} from '../../src/hooks/useDiscover';
import { logEvent, logEventDebounced } from '../../src/analytics/events';

const GRID_COLUMNS = 2;

export default function Discover() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { items: listings, loading, error } = useListings();
  const { uids: followingUids } = useFollowingUids();
  const hidden = useHiddenUids();

  // Blocked either way: her closet is not in the marketplace.
  const campusListings = useMemo(
    () => listings.filter((l) => !hidden.has(l.ownerUid)),
    [listings, hidden],
  );

  const { search, setSearch, filters, setFilters, sort, setSort } = useDiscoverState();
  const [tab, setTab] = useState<'explore' | 'following'>('explore');
  const [quickOccasion, setQuickOccasion] = useState<Occasion | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);

  // The quick chips above the grid are a shortcut into the same occasion
  // filter the sheet edits, so the two can never disagree.
  const effectiveFilters = useMemo<Filters>(
    () =>
      quickOccasion
        ? { ...filters, occasions: [...new Set([...filters.occasions, quickOccasion])] }
        : filters,
    [filters, quickOccasion],
  );

  const visible = useDiscoverResults({
    listings: campusListings,
    search,
    filters: effectiveFilters,
    sort,
    followingUids: tab === 'following' ? followingUids : null,
  });

  // What the sheet's button should say while she is still adjusting it.
  const previewCount = useDiscoverResults({
    listings: campusListings,
    search,
    filters: draftFilters,
    sort,
    followingUids: tab === 'following' ? followingUids : null,
  }).length;

  const cardWidth = (width - spacing.md * (GRID_COLUMNS + 1)) / GRID_COLUMNS;
  const activeCount = countActiveFilters(effectiveFilters);

  const openSort = () => {
    const labels = SORTS.map((s) => SORT_LABELS[s]);
    const choose = (index: number) => {
      const chosen = SORTS[index];
      if (!chosen) return;
      setSort(chosen);
      logEvent('filter_used', { surface: 'discover', meta: { sort: chosen } });
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', ...labels], cancelButtonIndex: 0, title: 'Sort by' },
        (index) => {
          if (index > 0) choose(index - 1);
        },
      );
    } else {
      Alert.alert('Sort by', undefined, [
        ...SORTS.map((s, i) => ({ text: SORT_LABELS[s], onPress: () => choose(i) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  return (
    <Screen flush>
      <View style={styles.header}>
        <Logo size={30} lockup="mark" />
        <Text variant="label">Discover</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchWrap}>
        <Text variant="h3" tone="muted" style={styles.searchGlyph}>
          ⌕
        </Text>
        <TextInput
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            // Debounced: one row when she stops typing, not one per key.
            if (value.trim().length > 2) {
              logEventDebounced('search', {
                surface: 'discover',
                meta: { length: value.trim().length },
              });
            }
          }}
          placeholder="Search closets and pieces"
          placeholderTextColor={color.text.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {search.length > 0 ? (
          <Text
            tone="muted"
            onPress={() => setSearch('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={styles.clear}
          >
            ✕
          </Text>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // flexGrow: 0 stops the flex column stretching the row to full
        // height, which would turn these into tall pills.
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {OCCASIONS.map((value) => (
          <Chip
            key={value}
            label={OCCASION_LABELS[value]}
            active={quickOccasion === value}
            onPress={() => {
              const next = quickOccasion === value ? null : value;
              setQuickOccasion(next);
              if (next) logEvent('filter_used', { surface: 'discover', meta: { occasion: next } });
            }}
          />
        ))}
      </ScrollView>

      <View style={styles.toolRow}>
        <Pressable
          style={[styles.toolButton, activeCount > 0 && styles.toolButtonActive]}
          accessibilityRole="button"
          onPress={() => {
            setDraftFilters(filters);
            setSheetOpen(true);
          }}
        >
          <Text variant="caption" tone={activeCount > 0 ? 'inverse' : 'primary'}>
            {activeCount > 0 ? `Filter · ${activeCount}` : 'Filter'}
          </Text>
        </Pressable>
        <Pressable style={styles.toolButton} accessibilityRole="button" onPress={openSort}>
          <Text variant="caption">{SORT_LABELS[sort]}</Text>
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
            <Text variant="label" tone={tab === value ? 'primary' : 'muted'}>
              {value}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : error ? (
        <EmptyState title="Couldn't load Discover" body={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={
            tab === 'following'
              ? 'Follow a few closets and their pieces show up here.'
              : search || activeCount > 0
                ? 'Try a different search, or loosen your filters.'
                : 'Closets on your campus will show up here as students list their pieces.'
          }
          actionLabel={activeCount > 0 ? 'Clear filters' : undefined}
          onAction={
            activeCount > 0
              ? () => {
                  setFilters(EMPTY_FILTERS);
                  setQuickOccasion(null);
                }
              : undefined
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
          // All matching listings are in memory; these keep the grid
          // smooth by only mounting the rows near the viewport.
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={
            <Text variant="caption" tone="muted" style={styles.count}>
              {visible.length} {visible.length === 1 ? 'piece' : 'pieces'}
            </Text>
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              width={cardWidth}
              onPressOwner={(username) => router.push(`/u/${username}`)}
              onPress={(listingId) =>
                router.push({ pathname: '/listing/[id]', params: { id: listingId } })
              }
            />
          )}
        />
      )}

      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        resultCount={previewCount}
        onPreview={setDraftFilters}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
          if (countActiveFilters(next) > 0) {
            logEvent('filter_used', {
              surface: 'discover',
              meta: {
                sizes: next.sizes.length,
                categories: next.categories.length,
                occasions: next.occasions.length,
                priced: Boolean(next.minPrice || next.maxPrice),
              },
            });
          }
        }}
        onClose={() => setSheetOpen(false)}
      />
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: controls.minTapTarget,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.pill,
  },
  searchGlyph: { marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    fontSize: type.bodySmall.size,
    color: color.text.primary,
    paddingVertical: 0,
  },
  clear: { paddingLeft: spacing.sm },
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: 'center' },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: controls.minTapTarget,
    minWidth: 130,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  toolButtonActive: {
    backgroundColor: color.surface.inverse,
    borderColor: color.border.inverse,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: color.border.inverse },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  count: { marginBottom: spacing.sm },
  grid: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  gridRow: { gap: spacing.md },
});
