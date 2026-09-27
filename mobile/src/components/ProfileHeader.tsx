/**
 * The top of a profile: photo, handle, campus, rating, bio, sizing and the
 * four stats. Shared by "my profile" and another student's profile so the
 * two can never drift apart — only the buttons underneath differ.
 */

import { StyleSheet, Text, View } from 'react-native';
import {
  SIZE_FIELDS,
  SIZE_FIELD_LABELS,
  colors,
  spacing,
  typography,
  type User,
} from '@loane/shared';
import { Avatar } from './Avatar';
import { StarRating } from './StarRating';
import { useCampusName } from '../hooks/useCampus';

interface Props {
  user: User;
  children?: React.ReactNode;
}

export function ProfileHeader({ user, children }: Props) {
  const { name: campusName, dotColor } = useCampusName(user.campusId);

  const stats = [
    { label: 'Followers', value: user.stats.followerCount },
    { label: 'Following', value: user.stats.followingCount },
    { label: 'Items', value: user.stats.listingCount },
    { label: 'Rentals', value: user.stats.rentalsAsLender + user.stats.rentalsAsRenter },
  ];

  const sizes = SIZE_FIELDS.map((field) => ({
    label: SIZE_FIELD_LABELS[field],
    value: user.sizes[field],
  })).filter((entry) => entry.value);

  return (
    <View>
      <View style={styles.identity}>
        <Avatar url={user.photoUrl} name={user.displayName} size={84} />
        <View style={styles.identityText}>
          <Text style={styles.displayName} numberOfLines={1}>
            {user.displayName}
          </Text>
          <Text style={styles.handle}>@{user.username}</Text>
          <View style={styles.campusRow}>
            <View style={[styles.campusDot, { backgroundColor: dotColor }]} />
            <Text style={styles.campus} numberOfLines={1}>
              {campusName}
            </Text>
          </View>
          <StarRating average={user.stats.ratingAverage} count={user.stats.ratingCount} />
        </View>
      </View>

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      {sizes.length > 0 ? (
        <View style={styles.sizeRow}>
          {sizes.map((entry) => (
            <View key={entry.label} style={styles.sizePill}>
              <Text style={styles.sizeLabel}>{entry.label}</Text>
              <Text style={styles.sizeValue}>{entry.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.statsRow}>
        {stats.map((stat, index) => (
          <View
            key={stat.label}
            style={[styles.stat, index === stats.length - 1 && styles.statLast]}
          >
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  identityText: { marginLeft: spacing.md, flex: 1 },
  displayName: { fontSize: typography.h3.size, fontWeight: '600', color: colors.textPrimary },
  handle: { fontSize: typography.bodySmall.size, color: colors.textSecondary, marginTop: 1 },
  campusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  campusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  campus: { flexShrink: 1, fontSize: typography.bodySmall.size, color: colors.textSecondary },
  bio: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  sizeLabel: {
    fontSize: typography.caption.size,
    letterSpacing: typography.caption.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginRight: 6,
  },
  sizeValue: { fontSize: typography.bodySmall.size, color: colors.textPrimary },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  statLast: { borderRightWidth: 0 },
  statValue: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  statLabel: {
    fontSize: typography.caption.size,
    letterSpacing: typography.caption.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
});
