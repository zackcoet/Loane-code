/**
 * Listing detail — the page that has to sell the piece.
 *
 * Renting and buying arrive in Phase 4/5, so those buttons say so rather
 * than pretending. Everything else is real.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SkeletonDetail } from '../../src/components/Skeleton';
import {
  addDays,
  toIsoDate,
  type Listing,
  CATEGORY_LABELS,
  OCCASION_LABELS,
  color,
  controls,
  formatCentsShort,
  spacing,
  type Condition,
  listingEntryPoint,
} from '@loane/shared';
import { Avatar } from '../../src/components/Avatar';
import { Button } from '../../src/components/Button';
import { ListingActions } from '../../src/components/ListingActions';
import { ProfileGateSheet } from '../../src/components/ProfileGateSheet';
import { useProfileGate } from '../../src/hooks/useProfileGate';
import { isTryOnEligible, useTryOnEnabled } from '../../src/hooks/useTryOn';
import { Chip } from '../../src/components/Chip';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadError } from '../../src/components/LoadError';
import { Header } from '../../src/components/Header';
import { IconButton } from '../../src/components/IconButton';
import { Screen } from '../../src/components/Screen';
import { StarRating } from '../../src/components/StarRating';
import { Icon } from '../../src/components/Icon';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthProvider';
import { useListing } from '../../src/hooks/useListing';
import { useUnavailableDates } from '../../src/hooks/useBookings';
import { useUserById } from '../../src/hooks/useProfile';
import { useIsSaved } from '../../src/hooks/useSaved';
import { usePostsTagging } from '../../src/hooks/usePostsTagging';
import { useOpenChat } from '../../src/hooks/useOpenChat';
import { useHiddenUids } from '../../src/hooks/useBlocks';
import { ReportSheet } from '../../src/components/ReportSheet';
import { logEvent } from '../../src/analytics/events';
import { ThumbImage } from '../../src/components/ThumbImage';

const CONDITION_LABELS: Record<Condition, string> = {
  new_with_tags: 'New with tags',
  like_new: 'Like new',
  good: 'Good',
  well_loved: 'Well loved',
};

export default function ListingDetail() {
  // Renting or buying means meeting another student in person, so
  // both need a photo and a phone number. useProfileGate owns the rule.
  const gate = useProfileGate();
  // The gate is the flat photo, not a setting: without one the button
  // is simply absent. See docs/decisions.md.
  const tryOnOn = useTryOnEnabled();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; from?: string }>();
  const { id } = params;
  const from = listingEntryPoint(params.from);
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const { listing, loading, notFound, failed, retry } = useListing(id);
  const { saved, toggle } = useIsSaved(id);
  const seenIn = usePostsTagging(id);
  const chat = useOpenChat();
  // Read live: a rating copied onto the listing would go stale the
  // moment somebody reviewed her.
  const owner = useUserById(listing?.ownerUid);
  const [reporting, setReporting] = useState(false);
  const hidden = useHiddenUids();

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
      meta: {
        category: listing.category,
        intent: listing.intent,
        ...(from ? { from } : {}),
      },
    });
  }, [listing, from]);

  if (loading) {
    return (
      <Screen flush>
        <Header title="" onBack={() => router.back()} />
        <SkeletonDetail aspectRatio={0.85} />
      </Screen>
    );
  }

  if (failed) {
    return (
      <Screen flush>
        <Header title="" onBack={() => router.back()} />
        <LoadError what="this piece" onRetry={retry} />
      </Screen>
    );
  }

  // A blocked closet (either way) reads exactly like a removed piece, so
  // nobody learns who blocked whom. Reached from an old link or a share.
  if (notFound || !listing || hidden.has(listing.ownerUid)) {
    return (
      <Screen flush>
        <Header title="" onBack={() => router.back()} />
        <EmptyState title="Not found" body="That piece is no longer listed." />
      </Screen>
    );
  }

  const isMine = listing.ownerUid === profile?.uid;
  // Looks by someone blocked either way stay out of "Seen in posts" too.
  const seenPosts = seenIn.posts.filter((post) => !hidden.has(post.authorUid));
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
          /*
            The heart shows on her OWN listing too, beside Edit. Saved
            is what feeds the fitting room, so a lender who could not
            save her own piece could not try it on — which is the first
            thing anyone does after listing something.
          */
          <View style={styles.headerActions}>
            <IconButton
              name={saved ? 'heart' : 'heart-outline'}
              accessibilityLabel={saved ? 'Remove from saved' : 'Save this piece'}
              onPress={() => void toggle('listing')}
            />
            {/* Send it to a friend — "would this work for Saturday?".
              Only while it is up: a paused or sold piece should not land
              in someone's chat looking available. */}
            {listing.status === 'active' ? (
              <IconButton
                name="paper-plane-outline"
                accessibilityLabel="Send this piece to someone"
                onPress={() =>
                  router.push({ pathname: '/send-post', params: { listingId: listing.id } })
                }
              />
            ) : null}
            {isMine ? (
              <IconButton
                name="create-outline"
                accessibilityLabel="Edit this listing"
                onPress={() =>
                  router.push({ pathname: '/edit-listing', params: { id: listing.id } })
                }
              />
            ) : null}
          </View>
        }
      />

      {/*
        `style` as well as `contentContainerStyle`, and the flex is the
        whole point.

        Without it the ScrollView has no height of its own inside a
        flex column: it takes its content's height, overflows the
        screen, and CLIPS instead of scrolling. It got away with that
        while there was one fixed sibling below it; adding the
        availability strip made it a second, and the page stopped
        scrolling entirely.
      */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
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
                <View key={photo.path} style={[styles.dot, index === page && styles.dotActive]} />
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
                <Chip
                  key={occasion}
                  label={OCCASION_LABELS[occasion]}
                  // It looked tappable and did nothing. Tapping an
                  // occasion on a dress means "show me more of these",
                  // so it opens Discover already filtered.
                  onPress={() =>
                    router.push({ pathname: '/(tabs)/discover', params: { occasion } })
                  }
                />
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
              <StarRating
                average={owner?.stats.ratingAverage ?? null}
                count={owner?.stats.ratingCount ?? 0}
                emptyLabel="No reviews yet"
              />
            </View>
            <Icon name="chevron-forward" size={20} tint={color.text.muted} />
          </Pressable>

          <Text
            variant="caption"
            tone="muted"
            accessibilityRole="button"
            onPress={() => setReporting(true)}
            style={styles.report}
          >
            Report this listing
          </Text>

          <View style={styles.seenIn}>
            <Text variant="label">Seen in posts</Text>
            {seenIn.loading ? null : seenPosts.length === 0 ? (
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
                {seenPosts.map((post) => (
                  <Pressable
                    key={post.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open @${post.author.username}'s look`}
                    onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
                    style={styles.seenInTile}
                  >
                    {post.photos[0] ? (
                      <ThumbImage
                        uri={post.photos[0].url}
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

      <ReportSheet
        visible={reporting}
        targetType="listing"
        targetId={listing.id}
        targetUid={listing.ownerUid}
        targetLabel={listing.name}
        onClose={() => setReporting(false)}
      />

      {/*
        The action bar is the same on her own listing as on anyone
        else's, with the buttons disabled. "What does my listing look
        like" is the first thing anyone asks after posting one, and a
        page that changes shape depending on who is looking cannot
        answer it.
      */}
      {/* When it is free, before she has to pick dates to find out.
          Read-only: choosing dates still happens on the request
          screen, where the price changes with the length. */}
      {!isMine && listing.intent !== 'sell' ? (
        <View style={styles.availability}>
          <Text variant="label" style={styles.availabilityLabel}>
            When it&apos;s free
          </Text>
          <AvailabilityStrip listing={listing} />
        </View>
      ) : null}

      <View style={styles.actionBar}>
        <ListingActions
          listing={listing}
          isMine={isMine}
          onLoaneIt={() =>
            gate.run('rent', () =>
              router.push({
                pathname: '/request-rental',
                params: { id: listing.id, ...(from ? { from } : {}) },
              }),
            )
          }
          onOwnIt={() =>
            gate.run('buy', () =>
              router.push({
                pathname: '/own-it',
                params: { id: listing.id, ...(from ? { from } : {}) },
              }),
            )
          }
        />
        {/* Try it on sits between the two buying actions and messaging:
            it is how she decides, not how she commits. Absent entirely
            without a lay-it-flat photo — no disclaimer, no greyed-out
            button, because a confidently wrong try-on is worse than no
            try-on. */}
        {tryOnOn && isTryOnEligible(listing) ? (
          <Button
            label="Try it on"
            variant="outline"
            // Straight into the dressing room with this piece on,
            // rather than a body-choice screen she has already answered.
            onPress={() => router.push({ pathname: '/try-on', params: { listing: listing.id } })}
          />
        ) : null}

        {/* Underneath, and quieter. Messaging is how a handoff gets
            arranged, not how a rental starts. */}
        {!isMine ? (
          <Button
            label={`Message @${listing.owner.username}`}
            variant="text"
            loading={chat.opening}
            onPress={() => void chat.open(listing.ownerUid, { listingId: listing.id })}
          />
        ) : null}
      </View>

      <ProfileGateSheet gate={gate} />
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

function AvailabilityStrip({ listing }: { listing: Listing }) {
  const unavailable = useUnavailableDates(listing);
  const today = toIsoDate(new Date());
  // Two weeks is the window a student actually plans in. Beyond that
  // the request screen's full calendar takes over.
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  return (
    <View style={styles.strip}>
      {days.map((d) => (
        <View key={d} style={styles.stripDay}>
          <Text variant="caption" tone="muted" uppercase={false}>
            {Number(d.slice(-2))}
          </Text>
          <View
            style={[styles.stripBar, unavailable.has(d) ? styles.stripOut : styles.stripFree]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  availability: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
  availabilityLabel: {},
  strip: { flexDirection: 'row', gap: 2 },
  stripDay: { flex: 1, alignItems: 'center', gap: 2 },
  stripBar: { width: '100%', height: 6, borderRadius: 2 },
  stripOut: { backgroundColor: color.role.shared.background },
  stripFree: { backgroundColor: color.surface.muted },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  scroll: { flex: 1 },
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
  report: { marginTop: spacing.xl, textDecorationLine: 'underline' },
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
  // A column now: the pitch and the two buttons stack, with Message
  // underneath. It was a row of three, which left no room for a price
  // on anything.
  actionBar: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    backgroundColor: color.surface.page,
  },
});
