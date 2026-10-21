/**
 * My Wishlist — Items, Looks and My Try-Ons.
 *
 * Two tabs rather than one mixed grid: a saved garment is something you
 * might rent, a saved look is inspiration. They are different things you
 * do different things with, so mixing them makes both harder to find.
 *
 * Both read live rather than from a copy taken at save time, so a piece
 * that has since been paused shows its real state.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { color, controls, radius, spacing, type TryOn } from '@loane/shared';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { ListingCard } from '../src/components/ListingCard';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useWishlist } from '../src/hooks/useSaved';
import { useSavedPosts } from '../src/hooks/usePostEngagement';
import { useMyTryOns, useSaveTryOn, useTryOnEnabled, useTryOnImage } from '../src/hooks/useTryOn';
import { useHiddenUids } from '../src/hooks/useBlocks';
import { ThumbImage } from '../src/components/ThumbImage';

const GRID_COLUMNS = 2;

export default function MyWishlist() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<'items' | 'looks' | 'tryons'>('items');

  const items = useWishlist();
  const looks = useSavedPosts();
  const tryOns = useMyTryOns();
  const tryOnOn = useTryOnEnabled();
  const hidden = useHiddenUids();

  /**
   * The fitting room door.
   *
   * Straight in. Her photo is saved, so there is nothing to choose —
   * and if she has not taken one yet, Try-On sends her to the camera
   * and brings her back here itself. One place decides that, rather
   * than every entry point checking.
   */
  const openFittingRoom = (listingId?: string) => {
    router.push({
      pathname: '/try-on',
      params: { source: 'saved', ...(listingId ? { listing: listingId } : {}) },
    });
  };

  const cardWidth = (width - spacing.md * (GRID_COLUMNS + 1)) / GRID_COLUMNS;

  // A saved piece can be paused, sold or taken down after she saved it.
  // A piece from a closet blocked either way counts as unavailable — it
  // reads like a removed piece, and she cannot rent it anyway.
  const isUp = (l: { status: string; ownerUid: string }) =>
    l.status === 'active' && !hidden.has(l.ownerUid);
  const available = items.listings.filter(isUp);
  const unavailable = items.listings.filter((l) => !isUp(l));

  return (
    <Screen flush>
      <Header title="My Wishlist" onBack={() => router.back()} />

      {/* The way in. Saved is where she has already shortlisted things,
          which makes it the closest thing Loane has to a fitting room. */}
      {tryOnOn ? (
        <Pressable
          onPress={() => openFittingRoom()}
          accessibilityRole="button"
          accessibilityLabel="Try on your saved pieces"
          style={({ pressed }) => [styles.fittingRoom, pressed && styles.fittingRoomPressed]}
        >
          <Icon name="sparkles" size={20} tint={color.role.shared.label} />
          <View style={styles.fittingRoomText}>
            <Text variant="bodySmall" tone="inverse" uppercase={false} style={styles.strong}>
              Try on your saved pieces
            </Text>
            <Text variant="caption" tone="inverse" uppercase={false} style={styles.quiet}>
              See them on you before you ask
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} tint={color.role.shared.label} />
        </Pressable>
      ) : null}

      <View style={styles.tabRow}>
        {(
          [
            ['items', `Items${items.listings.length ? ` · ${items.listings.length}` : ''}`],
            ['looks', `Looks${looks.posts.length ? ` · ${looks.posts.length}` : ''}`],
            /*
              A THIRD TAB, not an addition to Looks.

              A saved "look" is somebody else's outfit she liked. A saved
              try-on is her own body wearing a garment. Mixing them is
              both a privacy smell and a usability one, and the name
              "Looks" was taken long before try-on existed.
            */
            /*
              Try-on is off for v1, so the tab is not rendered at all —
              not greyed, not "coming soon". It should look like it
              never existed. See docs/decisions.md.
            */
            ...((tryOnOn
              ? [['tryons', `My Try-Ons${tryOns.items.length ? ` · ${tryOns.items.length}` : ''}`]]
              : []) as [typeof tab, string][]),
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
          >
            <Text variant="label" tone={tab === value ? 'primary' : 'muted'}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'items' ? (
        items.loading ? (
          <Loading />
        ) : items.listings.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            body="Tap the heart on a piece and it waits for you here."
            actionLabel="Browse closets"
            onAction={() => router.replace('/(tabs)/discover')}
          />
        ) : (
          <FlatList
            data={[...available, ...unavailable]}
            keyExtractor={(listing) => listing.id}
            numColumns={GRID_COLUMNS}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              unavailable.length > 0 ? (
                <Text variant="caption" tone="muted" style={styles.note}>
                  {unavailable.length} no longer available
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={item.status === 'active' ? undefined : styles.dimmed}>
                <ListingCard
                  listing={item}
                  width={cardWidth}
                  onTryOn={tryOnOn ? openFittingRoom : undefined}
                  onPressOwner={(username) => router.push(`/u/${username}`)}
                  onPress={(listingId) =>
                    router.push({ pathname: '/listing/[id]', params: { id: listingId } })
                  }
                />
              </View>
            )}
          />
        )
      ) : tab === 'tryons' ? (
        tryOns.loading ? (
          <Loading />
        ) : tryOns.items.length === 0 ? (
          <EmptyState
            title="No try-ons saved yet"
            body="Try a piece on and tap Save look. Only you can see these."
            actionLabel="Try something on"
            onAction={() => router.push('/try-on-body')}
          />
        ) : (
          <FlatList
            data={tryOns.items}
            keyExtractor={(t) => t.id}
            numColumns={GRID_COLUMNS}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <TryOnTile tryOn={item} width={cardWidth} />}
          />
        )
      ) : looks.loading ? (
        <Loading />
      ) : looks.posts.length === 0 ? (
        <EmptyState
          title="No looks saved yet"
          body="Tap the star on a look and it waits for you here."
          actionLabel="Browse the feed"
          onAction={() => router.replace('/(tabs)/feed')}
        />
      ) : (
        <FlatList
          data={looks.posts}
          keyExtractor={(post) => post.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.caption || 'Open look'}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
              style={[styles.lookTile, { width: cardWidth }]}
            >
              {item.photos[0] ? (
                <ThumbImage uri={item.photos[0].url} style={styles.lookImage} resizeMode="cover" />
              ) : null}
              {item.taggedListings.length > 0 ? (
                <View style={styles.lookBadge}>
                  <Text variant="caption" tone="inverse">
                    {item.taggedListings.length} tagged
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={color.icon.default} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: color.border.accent },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  fittingRoom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: controls.minTapTarget + 8,
    borderRadius: radius.md,
    backgroundColor: color.role.shared.background,
  },
  fittingRoomPressed: { opacity: 0.8 },
  fittingRoomText: { flex: 1, gap: 1, paddingVertical: spacing.sm },
  strong: { fontWeight: '600' },
  quiet: { opacity: 0.85 },
  tryOnImage: {
    borderRadius: radius.md,
    backgroundColor: color.surface.muted,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  tryOnDelete: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: color.scrim.onPhoto,
  },
  gridRow: { gap: spacing.md },
  note: { marginBottom: spacing.sm },
  dimmed: { opacity: 0.45 },
  lookTile: {
    aspectRatio: 0.8,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.surface.muted,
    overflow: 'hidden',
  },
  lookImage: { width: '100%', height: '100%' },
  lookBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: color.surface.inverse,
    opacity: 0.85,
  },
});

/**
 * One saved try-on.
 *
 * The image is fetched with HER credentials from an owner-read path,
 * so this tile simply cannot render for anybody else — which is the
 * privacy promise doing its job rather than being asserted.
 */
function TryOnTile({ tryOn, width }: { tryOn: TryOn; width: number }) {
  const url = useTryOnImage(tryOn.imagePath);
  const { remove } = useSaveTryOn();

  return (
    <View style={{ width }}>
      <View style={[styles.tryOnImage, { width, height: width * 1.4 }]}>
        {url ? (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        <Pressable
          onPress={() => void remove(tryOn.id)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Delete this try-on"
          style={styles.tryOnDelete}
        >
          <Icon name="close" size={14} tint={color.text.inverse} />
        </Pressable>
      </View>
      <Text variant="caption" tone="muted" numberOfLines={1} uppercase={false}>
        {tryOn.pieces.map((p: TryOn['pieces'][number]) => p.name).join(' + ') || 'Try-on'}
      </Text>
    </View>
  );
}
