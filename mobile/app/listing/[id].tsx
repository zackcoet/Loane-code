/**
 * Listing detail — the page that has to sell the piece.
 *
 * Renting and buying arrive in Phase 4/5, so those buttons say so rather
 * than pretending. Everything else is real.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  CATEGORY_LABELS,
  OCCASION_LABELS,
  color,
  controls,
  formatCentsShort,
  radius,
  spacing,
  type Condition,
} from '@loane/shared';
import { Avatar } from '../../src/components/Avatar';
import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { EmptyState } from '../../src/components/EmptyState';
import { Header } from '../../src/components/Header';
import { IconButton } from '../../src/components/IconButton';
import { Screen } from '../../src/components/Screen';
import { StarRating } from '../../src/components/StarRating';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthProvider';
import { useListing } from '../../src/hooks/useListing';
import { useIsSaved } from '../../src/hooks/useSaved';
import { usePostsTagging } from '../../src/hooks/usePostsTagging';
import { useOpenChat } from '../../src/hooks/useOpenChat';
import { logEvent } from '../../src/analytics/events';

const CONDITION_LABELS: Record<Condition, string> = {
  new_with_tags: 'New with tags',
  like_new: 'Like new',
  good: 'Good',
  well_loved: 'Well loved',
};

const SOON = 'Booking arrives in the next release. For now, message her closet.';

export default function ListingDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const { listing, loading, notFound } = useListing(id);
  const { saved, toggle } = useIsSaved(id);
  const seenIn = usePostsTagging(id);
  const chat = useOpenChat();

  const [page, setPage] = useState(0);
  const logged = useRef(false);

  // Log the view once per screen, not once per re-render.
  useEffect(() => {
    if (!listing || logged.current) return;
    logged.current = true;
    logEvent('listing_view', {
      surface: 'listing',
      targetType: 'listing',
      targetId: listing.id,
      meta: { category: listing.category, intent: listing.intent },
    });
  }, [listing]);

  if (loading) {
    return (
      <Screen flush>
        <Header title="" onBack={() => router.back()} />
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      </Screen>
    );
  }

  if (notFound || !listing) {
    return (
      <Screen flush>
        <Header title="" onBack={() => router.back()} />
        <EmptyState title="Not found" body="That piece is no longer listed." />
      </Screen>
    );
  }

  const isMine = listing.ownerUid === profile?.uid;
  const rentable = listing.intent === 'rent' || listing.intent === 'both';
  const sellable = listing.intent === 'sell' || listing.intent === 'both';

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));

  return (
    <Screen flush>
      <Header
        title={CATEGORY_LABELS[listing.category]}
        onBack={() => router.back()}
        right={
          isMine ? (
            <IconButton
              glyph="✎"
              accessibilityLabel="Edit this listing"
              onPress={() => router.push({ pathname: '/edit-listing', params: { id: listing.id } })}
            />
          ) : (
            <IconButton
              glyph={saved ? '♥' : '♡'}
              accessibilityLabel={saved ? 'Remove from wishlist' : 'Save to wishlist'}
              onPress={() => void toggle('listing')}
            />
          )
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Photo carousel */}
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
          >
            {listing.photos.map((photo, index) => (
              <Image
                key={`${photo.path}-${index}`}
                source={{ uri: photo.url }}
                style={[styles.photo, { width }]}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {listing.photos.length > 1 ? (
            <View style={styles.dots}>
              {listing.photos.map((photo, index) => (
                <View
                  key={photo.path}
                  style={[styles.dot, index === page && styles.dotActive]}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text variant="h3">{listing.name}</Text>
          {listing.brand ? (
            <Text variant="bodySmall" tone="secondary" style={styles.brand}>
              {listing.brand}
            </Text>
          ) : null}

          {/* Price */}
          <View style={styles.priceBlock}>
            {rentable && listing.pricing.threeDayCents != null ? (
              <View style={styles.priceRow}>
                <Text variant="h3">{formatCentsShort(listing.pricing.threeDayCents)}</Text>
                <Text variant="bodySmall" tone="secondary" style={styles.per}>
                  for 3 days
                </Text>
                {listing.pricing.sevenDayCents != null ? (
                  <Text variant="bodySmall" tone="secondary" style={styles.alsoPrice}>
                    · {formatCentsShort(listing.pricing.sevenDayCents)} for 7
                  </Text>
                ) : null}
              </View>
            ) : null}
            {sellable && listing.salePriceCents != null ? (
              <Text variant="bodySmall" tone="secondary" style={styles.salePrice}>
                Buy it outright for {formatCentsShort(listing.salePriceCents)}
              </Text>
            ) : null}
          </View>

          {/* Facts */}
          <View style={styles.factRow}>
            {listing.size ? <Fact label="Size" value={listing.size} /> : null}
            {listing.shoeSize ? <Fact label="Shoe" value={listing.shoeSize} /> : null}
            <Fact label="Condition" value={CONDITION_LABELS[listing.condition]} />
            <Fact label="Category" value={CATEGORY_LABELS[listing.category]} />
          </View>

          {listing.occasions.length > 0 ? (
            <View style={styles.chipRow}>
              {listing.occasions.map((occasion) => (
                <Chip key={occasion} label={OCCASION_LABELS[occasion]} onPress={() => {}} />
              ))}
            </View>
          ) : null}

          {listing.description ? (
            <Text style={styles.description}>{listing.description}</Text>
          ) : null}

          {/* Lender */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open @${listing.owner.username}'s closet`}
            onPress={() => router.push(`/u/${listing.owner.username}`)}
            style={({ pressed }) => [styles.lender, pressed && styles.lenderPressed]}
          >
            <Avatar url={listing.owner.photoUrl} name={listing.owner.displayName} size={48} />
            <View style={styles.lenderText}>
              <Text variant="caption" tone="muted">
                From the closet of
              </Text>
              <Text numberOfLines={1}>@{listing.owner.username}</Text>
              <StarRating average={null} count={0} />
            </View>
            <Text variant="h3" tone="muted">
              ›
            </Text>
          </Pressable>

          <View style={styles.seenIn}>
            <Text variant="label">Seen in posts</Text>
            {seenIn.loading ? null : seenIn.posts.length === 0 ? (
              <Text variant="bodySmall" tone="muted" style={styles.seenInBody}>
                Looks featuring this piece will show up here.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.seenInScroll}
                contentContainerStyle={styles.seenInRow}
              >
                {seenIn.posts.map((post) => (
                  <Pressable
                    key={post.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open @${post.author.username}'s look`}
                    onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
                    style={styles.seenInTile}
                  >
                    {post.photos[0] ? (
                      <Image
                        source={{ uri: post.photos[0].url }}
                        style={styles.seenInImage}
                        resizeMode="cover"
                      />
                    ) : null}
                    <Text variant="caption" tone="muted" numberOfLines={1} style={styles.seenInWho}>
                      @{post.author.username}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      {!isMine ? (
        <View style={styles.actionBar}>
          <Button
            label="Message"
            variant="outline"
            loading={chat.opening}
            onPress={() => void chat.open(listing.ownerUid, { listingId: listing.id })}
            style={styles.saveButton}
          />
          {rentable ? (
            <Button
              label="Request to rent"
              onPress={() =>
                router.push({ pathname: '/request-rental', params: { id: listing.id } })
              }
              style={styles.primaryAction}
            />
          ) : null}
          {sellable && !rentable ? (
            <Button
              label="Buy"
              // TODO-PHASE5: payments.
              onPress={() => Alert.alert('Coming soon', SOON)}
              style={styles.primaryAction}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="bodySmall">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: spacing.xxl },
  photo: { aspectRatio: 0.85, backgroundColor: color.surface.muted },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.border.default },
  dotActive: { backgroundColor: color.surface.inverse },
  body: { padding: spacing.md },
  brand: { marginTop: 2 },
  priceBlock: { marginTop: spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  per: { marginLeft: spacing.sm },
  alsoPrice: { marginLeft: spacing.sm },
  salePrice: { marginTop: spacing.xs },
  factRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: color.border.default,
  },
  fact: {
    flexGrow: 1,
    flexBasis: '50%',
    padding: spacing.md,
    gap: 2,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  description: { marginTop: spacing.lg },
  lender: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: color.border.default,
    minHeight: controls.minTapTarget,
  },
  lenderPressed: { backgroundColor: color.surface.muted },
  lenderText: { flex: 1, marginLeft: spacing.md },
  seenIn: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
  seenInBody: { marginTop: spacing.xs },
  seenInScroll: { flexGrow: 0, flexShrink: 0, marginTop: spacing.md },
  seenInRow: { gap: spacing.sm },
  seenInTile: { width: 96 },
  seenInImage: {
    width: 96,
    height: 120,
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.surface.muted,
  },
  seenInWho: { marginTop: 4 },
  actionBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    backgroundColor: color.surface.page,
  },
  saveButton: { flex: 1, height: controls.buttonHeightSmall, borderRadius: radius.sm },
  primaryAction: { flex: 2, height: controls.buttonHeightSmall },
});
