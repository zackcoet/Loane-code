/**
 * One outfit post in the feed.
 *
 * Tapping the photo shows or hides the tag dots; tapping a dot opens its
 * label with the item name and price; tapping the label opens the
 * listing. That last tap is the one that matters — it is the social side
 * handing the marketplace a customer, and it is what `tagged_item_tap`
 * measures.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { OCCASION_LABELS, color, controls, spacing, type Post } from '@loane/shared';
import { Avatar } from './Avatar';
import { TaggablePhoto } from './TaggablePhoto';
import { Text } from './Text';
import { useIsLiked, useIsPostSaved } from '../hooks/usePostEngagement';

interface Props {
  post: Post;
  onPressTag: (listingId: string) => void;
  onPressAuthor: (username: string) => void;
  /** Shown on her own posts. */
  onEdit?: () => void;
}

export function PostCard({ post, onPressTag, onPressAuthor, onEdit }: Props) {
  const { width } = useWindowDimensions();
  const [tagsVisible, setTagsVisible] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const liked = useIsLiked(post.id);
  const saved = useIsPostSaved(post.id);

  // Double tap likes; it never un-likes. Tapping twice more by accident
  // and silently undoing a like is worse than the accidental like.
  const onDoubleTap = () => {
    if (!liked.on) void liked.toggle();
  };

  const photos = post.photos ?? [];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          style={styles.author}
          accessibilityRole="button"
          accessibilityLabel={`Open @${post.author.username}'s closet`}
          onPress={() => onPressAuthor(post.author.username)}
        >
          <Avatar url={post.author.photoUrl} name={post.author.displayName} size={44} />
          <View style={styles.authorText}>
            <Text variant="bodySmall" style={styles.username}>
              @{post.author.username}
            </Text>
            {post.occasions.length > 0 ? (
              <Text variant="caption" tone="muted">
                {post.occasions.map((o) => OCCASION_LABELS[o]).join(' · ')}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {onEdit ? (
          <Text
            variant="caption"
            tone="muted"
            accessibilityRole="button"
            onPress={onEdit}
            style={styles.edit}
          >
            Edit
          </Text>
        ) : null}
      </View>

      {photos.length > 1 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {photos.map((photo, index) => (
            <View key={`${photo.path}-${index}`} style={{ width }}>
              <TaggablePhoto
                uri={photo.url}
                mode="view"
                tags={(photo.tags ?? []).map((tag) => ({
                  listingId: tag.listingId,
                  x: tag.x,
                  y: tag.y,
                  name: tag.label.name,
                  priceCents3Day: tag.label.priceCents3Day,
                  salePriceCents: tag.label.salePriceCents,
                }))}
                tagsVisible={tagsVisible}
                onToggleTags={() => {
                  setTagsVisible((v) => !v);
                  setExpanded(null);
                }}
                onExpandTag={setExpanded}
                onOpenTag={onPressTag}
                onDoubleTap={onDoubleTap}
                expandedListingId={expanded}
              />
            </View>
          ))}
        </ScrollView>
      ) : photos[0] ? (
        <TaggablePhoto
          uri={photos[0].url}
          mode="view"
          tags={(photos[0].tags ?? []).map((tag) => ({
            listingId: tag.listingId,
            x: tag.x,
            y: tag.y,
            name: tag.label.name,
            priceCents3Day: tag.label.priceCents3Day,
            salePriceCents: tag.label.salePriceCents,
          }))}
          tagsVisible={tagsVisible}
          onToggleTags={() => {
            setTagsVisible((v) => !v);
            setExpanded(null);
          }}
          onExpandTag={setExpanded}
          onOpenTag={onPressTag}
          onDoubleTap={onDoubleTap}
          expandedListingId={expanded}
        />
      ) : null}

      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.map((photo, index) => (
            <View key={photo.path} style={[styles.dot, index === page && styles.dotActive]} />
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => void liked.toggle()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={liked.on ? 'Unlike' : 'Like'}
          style={styles.action}
        >
          <Text variant="h3">{liked.on ? '♥' : '♡'}</Text>
        </Pressable>
        <Pressable
          onPress={() => void saved.toggle()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={saved.on ? 'Remove from wishlist' : 'Save this look'}
          style={styles.action}
        >
          <Text variant="h3">{saved.on ? '★' : '☆'}</Text>
        </Pressable>
        <View style={styles.spacer} />
        {post.taggedListings.length > 0 ? (
          <Text variant="caption" tone="muted">
            {post.taggedListings.length === 1
              ? '1 piece tagged'
              : `${post.taggedListings.length} pieces tagged`}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        {post.stats.likeCount > 0 ? (
          <Text variant="bodySmall" style={styles.likes}>
            {post.stats.likeCount} {post.stats.likeCount === 1 ? 'like' : 'likes'}
          </Text>
        ) : null}
        {post.caption ? (
          <Text>
            <Text style={styles.username}>@{post.author.username} </Text>
            {post.caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
    paddingBottom: spacing.md,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  author: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  authorText: { marginLeft: spacing.md, flex: 1 },
  username: { fontWeight: '600' },
  edit: { textDecorationLine: 'underline', paddingHorizontal: spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', paddingTop: spacing.sm, gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.border.default },
  dotActive: { backgroundColor: color.surface.inverse },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  action: { minWidth: 32, minHeight: controls.minTapTarget, justifyContent: 'center' },
  spacer: { flex: 1 },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  likes: { fontWeight: '600', marginBottom: 2 },
});
