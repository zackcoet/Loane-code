/**
 * One outfit post in the feed.
 *
 * The tagged-garment row under the photo is the bridge from "cute outfit"
 * to "rent this" — tapping it is the single most important interaction in
 * the product, so it is a visible row rather than a hidden hotspot.
 */

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import {
  OCCASION_LABELS,
  colors,
  formatCentsShort,
  spacing,
  typography,
  type Post,
} from '@loane/shared';

interface Props {
  post: Post;
  onPressTag?: (listingId: string) => void;
  onPressAuthor?: (username: string) => void;
}

export function PostCard({ post, onPressTag, onPressAuthor }: Props) {
  const photo = post.photos[0];

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={`Open @${post.author.username}'s closet`}
        onPress={() => onPressAuthor?.(post.author.username)}
      >
        <Avatar url={post.author.photoUrl} name={post.author.displayName} size={44} />
        <View style={styles.headerText}>
          <Text style={styles.username}>@{post.author.username}</Text>
          {post.occasions.length > 0 ? (
            <Text style={styles.occasions}>
              {post.occasions.map((o) => OCCASION_LABELS[o]).join(' · ')}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {photo ? (
        <Image source={{ uri: photo.url }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]} />
      )}

      {post.taggedListings.map((tagged) => (
        <Pressable
          key={tagged.listingId}
          style={styles.tagRow}
          accessibilityRole="button"
          accessibilityLabel={`View ${tagged.name}`}
          onPress={() => onPressTag?.(tagged.listingId)}
        >
          <View style={styles.tagThumb} />
          <View style={styles.tagText}>
            <Text style={styles.tagName} numberOfLines={1}>
              {tagged.name}
            </Text>
            {tagged.priceCents3Day != null ? (
              <Text style={styles.tagPrice}>
                {formatCentsShort(tagged.priceCents3Day)} · 3 days
              </Text>
            ) : null}
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

      <View style={styles.footer}>
        <Text style={styles.caption}>
          <Text style={styles.captionName}>@{post.author.username} </Text>
          {post.caption}
        </Text>
        {post.stats.likeCount > 0 ? (
          <Text style={styles.likes}>
            {post.stats.likeCount} {post.stats.likeCount === 1 ? 'like' : 'likes'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerText: { marginLeft: spacing.md, flex: 1 },
  username: { fontSize: typography.bodySmall.size, fontWeight: '600', color: colors.textPrimary },
  occasions: {
    fontSize: typography.caption.size,
    letterSpacing: typography.caption.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 2,
  },
  photo: { width: '100%', aspectRatio: 0.8, backgroundColor: colors.surfaceMuted },
  photoPlaceholder: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    minHeight: 56,
  },
  tagThumb: {
    width: 40,
    height: 40,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: { flex: 1, marginLeft: spacing.md },
  tagName: { fontSize: typography.bodySmall.size, color: colors.textPrimary },
  tagPrice: { fontSize: typography.caption.size, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted, paddingHorizontal: spacing.sm },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  caption: {
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  captionName: { fontWeight: '600' },
  likes: { fontSize: typography.bodySmall.size, color: colors.textSecondary, marginTop: spacing.sm },
});
