/**
 * Discover — the marketplace.
 *
 * One query goes to the server (active listings on my campus, newest
 * first) and search, filters and sort all run on the phone. That is a
 * deliberate choice; the reasoning and the point at which we outgrow it
 * are written up in src/hooks/useDiscover.ts and docs/roadmap.md.
 */

import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActionSheetIOS,
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
  fonts,
  OCCASIONS,
  OCCASION_LABELS,
  type Occasion,
  type ListingEntryPoint,
  color,
  controls,
  iconSize,
  radius,
  spacing,
  type,
} from '@loane/shared';
import { Chip } from '../../src/components/Chip';
import { EmptyState } from '../../src/components/EmptyState';
import { FilterSheet } from '../../src/components/FilterSheet';
import { ListingCard } from '../../src/components/ListingCard';
import { TrendingRow } from '../../src/components/TrendingRow';
import { Logo } from '../../src/components/Logo';
import { LoaneLoader } from '../../src/components/LoaneLoader';
import { Screen } from '../../src/components/Screen';
import { Icon } from '../../src/components/Icon';
import { Text } from '../../src/components/Text';
import { useListings } from '../../src/hooks/useFeed';
import { useRankingViewer } from '../../src/hooks/useRankingViewer';
import { useDiscoverForYou } from '../../src/hooks/useDiscoverForYou';
import { useFollowingUids } from '../../src/hooks/useFollowing';
import { useHiddenUids } from '../../src/hooks/useBlocks';
import { useCampus } from '../../src/hooks/useCampus';
import { useTrendingIds } from '../../src/hooks/useTrending';
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
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';

const GRID_COLUMNS = 2;

export default function Discover() {
  const router = useRouter();
  // Arriving from an occasion chip on a listing: "more things like this
  // one, for the same occasion". Read once into the same quick-filter
  // state the chips above the grid use, so the two cannot disagree.
  const { occasion: occasionParam } = useLocalSearchParams<{ occasion?: string }>();
  const { width } = useWindowDimensions();
  const { items: listings, loading, error, retry } = useListings();
  const { uids: followingUids } = useFollowingUids();
  const hidden = useHiddenUids();
  const ranking = useRankingViewer();
  // Pulling down works out the For you order again with her latest
  // likes; the pieces themselves are live and already current.
  const { refreshControl } = usePullToRefresh(ranking.reload);

  // Blocked either way: her closet is not in the marketplace.
  const campusListings = useMemo(
    () => listings.filter((l) => !hidden.has(l.ownerUid)),
    [listings, hidden],
  );

  const { search, setSearch, filters, setFilters, sort, setSort } = useDiscoverState();
  // "For you" is the default sort — see useDiscoverForYou.
  const forYouRank = useDiscoverForYou(campusListings, ranking.viewer);
  const [tab, setTab] = useState<'explore' | 'following'>('explore');
  const [quickOccasion, setQuickOccasion] = useState<Occasion | null>(
    OCCASIONS.includes(occasionParam as Occasion) ? (occasionParam as Occasion) : null,
  );
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
    forYouRank,
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

  // Trending this week: ids from the hourly server job, looked up among
  // the pieces already loaded, so blocked closets and sold pieces drop
  // out for free. Only while she is browsing everything.
  const { campus } = useCampus();
  const trendingIds = useTrendingIds();
  const trending = useMemo(() => {
    const byId = new Map(campusListings.map((l) => [l.id, l]));
    return trendingIds.flatMap((id) => {
      const listing = byId.get(id);
      return listing ? [listing] : [];
    });
  }, [trendingIds, campusListings]);
  const showTrending = tab === 'explore' && search.trim() === '' && activeCount === 0;
  const openListing = (listingId: string) =>
    router.push({ pathname: '/listing/[id]', params: { id: listingId } });
  // Tagged so the piece's view, and any request she makes from it, says
  // it came from Trending. See LISTING_ENTRY_POINTS.
  const openTrendingListing = (listingId: string) =>
    router.push({
      pathname: '/listing/[id]',
      params: { id: listingId, from: 'trending' satisfies ListingEntryPoint },
    });
  const openOwner = (username: string) => router.push(`/u/${username}`);

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
        <View style={styles.logoLift}>
          <Logo size={30} lockup="mark" />
        </View>
        <Text variant="label">Discover</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchWrap}>
        <Icon name="search" size={iconSize.sm} tint={color.text.muted} />
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
          <Pressable
            onPress={() => setSearch('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={10}
            style={styles.clear}
          >
            <Icon name="close-circle" size={iconSize.sm} tint={color.text.muted} />
          </Pressable>
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
          <Text variant="caption" tone="primary">
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
          <LoaneLoader size={34} />
        </View>
      ) : error ? (
        <EmptyState
          title="Couldn't load Discover"
          body={error}
          actionLabel="Try again"
          onAction={retry}
        />
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
          refreshControl={refreshControl}
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
            <>
              {showTrending ? (
                <TrendingRow
                  listings={trending}
                  campusShortName={campus?.shortName ?? null}
                  cardWidth={cardWidth * 0.8}
                  onPress={openTrendingListing}
                  onPressOwner={openOwner}
                />
              ) : null}
              <Text variant="caption" tone="muted" style={styles.count}>
                {visible.length} {visible.length === 1 ? 'piece' : 'pieces'}
              </Text>
            </>
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              width={cardWidth}
              onPressOwner={openOwner}
              onPress={openListing}
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
    height: controls.headerHeight - 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  logoLift: { transform: [{ translateY: -4 }] },
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
    fontFamily: fonts.body,
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
    backgroundColor: color.role.shared.background,
    borderColor: color.role.shared.border,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: color.border.accent },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  count: { marginBottom: spacing.sm },
  grid: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  gridRow: { gap: spacing.md },
});
