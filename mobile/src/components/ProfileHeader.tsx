/**
 * The top of a profile — a shop window, not a social profile.
 *
 * Loane is a rental app, so what matters here is what she has, what it
 * costs and how to ask for it. That is why the four big stat boxes are
 * gone: "Items" and "Rentals" as numbers in a grid told you nothing you
 * could act on, and they pushed the closet below the fold. What is left
 * is her identity, her sizes, one line saying what renting from her
 * costs, and the buttons to act.
 *
 * Followers and Following survive as small tappable counts on the right,
 * the way Instagram does it — they are worth a number and not worth a
 * quarter of the screen.
 *
 * Shared by "my profile" and another student's so the two can never
 * drift apart. Only the buttons underneath differ.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import {
  SIZE_FIELDS,
  SIZE_FIELD_LABELS,
  color,
  formatCentsShort,
  radius,
  spacing,
  type User,
} from '@loane/shared';
import { Avatar } from './Avatar';
import { StarRating } from './StarRating';
import { Text } from './Text';
import { useCampusName } from '../hooks/useCampus';
import { useUserListings } from '../hooks/useProfile';

interface Props {
  user: User;
  children?: React.ReactNode;
  onPressPhoto?: () => void;
  onPressFollowers?: () => void;
  onPressFollowing?: () => void;
  /** Opens the reviews she has received. */
  onPressRating?: () => void;
}

export function ProfileHeader({
  user,
  children,
  onPressPhoto,
  onPressFollowers,
  onPressFollowing,
  onPressRating,
}: Props) {
  const { name: campusName, dotColor } = useCampusName(user.campusId);
  const { items: listings } = useUserListings(user.uid);

  // Hidden unless she has turned them on. Her sizes help a renter judge
  // fit, but they are also a fact about her body on a page anyone at her
  // school can open — that is hers to publish, not ours.
  const sizes = user.showSizes
    ? SIZE_FIELDS.map((field) => ({
        label: SIZE_FIELD_LABELS[field],
        value: user.sizes[field],
      })).filter((entry) => entry.value)
    : [];

  // "12 pieces · from $15 / 3 days" — the shop-window line. The cheapest
  // way in is the number somebody actually decides on, and having it up
  // here means she never has to scroll the grid to find the floor.
  const rentPrices = listings
    .map((listing) => listing.pricing?.threeDayCents)
    .filter((cents): cents is number => typeof cents === 'number');
  const cheapest = rentPrices.length > 0 ? Math.min(...rentPrices) : null;

  return (
    <View>
      <View style={styles.identity}>
        {onPressPhoto ? (
          <Pressable
            onPress={onPressPhoto}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            <Avatar url={user.photoUrl} name={user.displayName} size={72} />
          </Pressable>
        ) : (
          <Avatar url={user.photoUrl} name={user.displayName} size={72} />
        )}

        <View style={styles.counts}>
          <Count value={user.stats.followerCount} label="Followers" onPress={onPressFollowers} />
          <Count value={user.stats.followingCount} label="Following" onPress={onPressFollowing} />
        </View>
      </View>

      <View style={styles.nameBlock}>
        <Text variant="h3" numberOfLines={1}>
          {user.displayName}
        </Text>
        <Text variant="bodySmall" tone="secondary" style={styles.handle}>
          @{user.username}
        </Text>

        <View style={styles.campusRow}>
          <View style={[styles.campusDot, { backgroundColor: dotColor }]} />
          <Text variant="bodySmall" tone="secondary" numberOfLines={1} style={styles.campus}>
            {campusName}
          </Text>
        </View>

        {/* The rating is the way in to her reviews. Nothing else on a
            profile is a more natural place to tap for them. */}
        <Pressable
          onPress={onPressRating}
          disabled={!onPressRating}
          accessibilityRole={onPressRating ? 'button' : undefined}
          accessibilityLabel={
            user.stats.ratingCount > 0 ? `See all ${user.stats.ratingCount} reviews` : undefined
          }
          style={styles.rating}
        >
          <StarRating
            average={user.stats.ratingAverage}
            count={user.stats.ratingCount}
            emptyLabel="No reviews yet"
            highlight
          />
        </Pressable>

        {user.bio ? (
          <Text variant="body" style={styles.bio}>
            {user.bio}
          </Text>
        ) : null}
      </View>

      {sizes.length > 0 ? (
        <View style={styles.sizeRow}>
          {sizes.map((entry) => (
            <View key={entry.label} style={styles.sizePill}>
              <Text variant="caption" tone="muted">
                {entry.label}
              </Text>
              <Text variant="bodySmall" style={styles.sizeValue}>
                {entry.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* The shop-window line. The closet size is the one number that
          says "there is something here to rent", so it carries the
          accent; the price stays plain text beside it rather than
          competing with it for attention. */}
      {listings.length > 0 ? (
        <View style={styles.shopLine}>
          <View style={styles.countTag}>
            <Text variant="caption" style={styles.countTagText} uppercase={false}>
              {listings.length} {listings.length === 1 ? 'piece' : 'pieces'}
            </Text>
          </View>
          {cheapest != null ? (
            <Text variant="bodySmall" tone="secondary">
              {'from '}
              <Text variant="bodySmall" style={styles.strong}>
                {formatCentsShort(cheapest)}
              </Text>
              {' / 3 days'}
            </Text>
          ) : null}
        </View>
      ) : null}

      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

/** A follower or following count. Tappable when there is a list to open. */
function Count({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => [styles.count, pressed && onPress ? styles.pressed : null]}
    >
      <Text variant="body" style={styles.strong}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  counts: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  count: { alignItems: 'center', minWidth: 64, paddingVertical: spacing.xs },
  pressed: { opacity: 0.6 },
  nameBlock: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  campusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  campusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  campus: { flexShrink: 1 },
  rating: { alignSelf: 'flex-start', marginTop: 5 },
  bio: { marginTop: spacing.sm },
  strong: { fontWeight: '600' },
  // The handle is how people refer to each other here, so it carries
  // more weight than a secondary line usually would.
  handle: { fontWeight: '600' },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  sizePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  sizeValue: {},
  shopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  countTag: {
    borderRadius: radius.sm,
    backgroundColor: color.accent.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countTagText: { color: color.accent.label, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
});
