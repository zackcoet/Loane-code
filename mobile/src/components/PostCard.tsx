/**
 * One outfit post in the feed.
 *
 * The shape is Instagram's on purpose. Every girl this is for already
 * knows where the like button is and what a row of dots means, and a
 * new app is not the place to teach someone a new gesture.
 *
 * What is ours is the row underneath: tapping the photo shows the tag
 * dots, and "See tagged pieces" opens the panel that turns a look into
 * a rental. That tap is the one that matters — it is the social side
 * handing the marketplace a customer, and it is what `tagged_item_tap`
 * measures.
 */

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  LIMITS,
  color,
  controls,
  iconSize,
  radius,
  spacing,
  timeAgo,
  type Post,
} from '@loane/shared';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { TaggablePhoto } from './TaggablePhoto';
import { TaggedPieces } from './TaggedPieces';
import { Text } from './Text';
import { useIsLiked, useIsPostSaved } from '../hooks/usePostEngagement';

/** Longer than this and the caption gets a "more". */
const CAPTION_PREVIEW_CHARS = 120;

interface Props {
  post: Post;
  onPressTag: (listingId: string) => void;
  onPressAuthor: (username: string) => void;
  onPressComments: () => void;
  onPressSend: () => void;
  onPressLikes: () => void;
  onMessageSeller: (ownerUid: string, listingId: string) => void;
  /** Shown on her own posts. */
  onEdit?: () => void;
  /** True when this is the signed-in student's own look. */
  isMine?: boolean;
}

export function PostCard({
  post,
  onPressTag,
  onPressAuthor,
  onPressComments,
  onPressSend,
  onPressLikes,
  onMessageSeller,
  onEdit,
  isMine = false,
}: Props) {
  const { width } = useWindowDimensions();
  const [tagsVisible, setTagsVisible] = useState(false);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [piecesOpen, setPiecesOpen] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);

  const liked = useIsLiked(post.id);
  const saved = useIsPostSaved(post.id);

  // Double tap likes; it never un-likes. Tapping twice more by accident
  // and silently undoing a like is worse than the accidental like.
  const onDoubleTap = () => {
    if (!liked.on) void liked.toggle();
  };

  const photos = post.photos ?? [];
  const caption = post.caption ?? '';
  const longCaption = caption.length > CAPTION_PREVIEW_CHARS;
  const shownCaption =
    longCaption && !captionOpen ? `${caption.slice(0, CAPTION_PREVIEW_CHARS).trimEnd()}… ` : caption;

  const photoTags = (index: number) =>
    (photos[index]?.tags ?? []).map((tag) => ({
      listingId: tag.listingId,
      x: tag.x,
      y: tag.y,
      name: tag.label.name,
      priceCents3Day: tag.label.priceCents3Day,
      salePriceCents: tag.label.salePriceCents,
    }));

  const photoProps = (index: number) => ({
    uri: photos[index]!.url,
    mode: 'view' as const,
    tags: photoTags(index),
    tagsVisible,
    onToggleTags: () => {
      setTagsVisible((v) => !v);
      setExpandedTag(null);
    },
    onExpandTag: setExpandedTag,
    onOpenTag: onPressTag,
    onDoubleTap,
    expandedListingId: expandedTag,
    zoomable: true,
  });

  return (
    <View style={styles.card}>
      {/* Header — who posted it. */}
      <View style={styles.header}>
        <Pressable
          style={styles.author}
          accessibilityRole="button"
          accessibilityLabel={`Open @${post.author.username}'s closet`}
          onPress={() => onPressAuthor(post.author.username)}
        >
          <Avatar url={post.author.photoUrl} name={post.author.displayName} size={36} />
          <Text variant="bodySmall" style={styles.username} numberOfLines={1}>
            @{post.author.username}
          </Text>
        </Pressable>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Edit this look"
            style={styles.more}
          >
            <Icon name="ellipsis-horizontal" size={iconSize.sm} />
          </Pressable>
        ) : null}
      </View>

      {/* Photos — swipe between them, with a counter in the corner. */}
      <View>
        {photos.length > 1 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPage(Math.round(e.nativeEvent.contentOffset.x / width))
            }
          >
            {photos.map((photo, index) => (
              <View key={`${photo.path}-${index}`} style={{ width }}>
                <TaggablePhoto {...photoProps(index)} />
              </View>
            ))}
          </ScrollView>
        ) : photos[0] ? (
          <TaggablePhoto {...photoProps(0)} />
        ) : null}

        {photos.length > 1 ? (
          <View style={styles.counter} pointerEvents="none">
            <Text variant="caption" tone="inverse" uppercase={false}>
              {page + 1}/{photos.length}
            </Text>
          </View>
        ) : null}
      </View>

      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.map((photo, index) => (
            <View
              key={`${photo.path}-${index}`}
              style={[styles.dot, index === page && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}

      {/* Like, comment, send on the left; save on the right. */}
      <View style={styles.actions}>
        <Action
          icon={liked.on ? 'heart' : 'heart-outline'}
          tint={liked.on ? color.status.error : color.icon.default}
          label={liked.on ? 'Unlike' : 'Like'}
          count={post.stats.likeCount}
          onPress={() => void liked.toggle()}
        />
        <Action
          icon="chatbubble-outline"
          label="Comments"
          count={post.stats.commentCount ?? 0}
          onPress={onPressComments}
        />
        <Action
          icon="paper-plane-outline"
          label="Send this look to someone"
          count={post.stats.shareCount ?? 0}
          onPress={onPressSend}
        />
        <View style={styles.spacer} />
        <Action
          icon={saved.on ? 'bookmark' : 'bookmark-outline'}
          label={saved.on ? 'Remove from wishlist' : 'Save this look'}
          onPress={() => void saved.toggle()}
        />
      </View>

      <View style={styles.footer}>
        {/* Liked by. */}
        {post.stats.likeCount > 0 ? (
          post.lastLiker ? (
            <Pressable
              style={styles.likedBy}
              accessibilityRole="button"
              accessibilityLabel={`See everyone who liked this, ${post.stats.likeCount} people`}
              onPress={onPressLikes}
            >
              <Avatar
                url={post.lastLiker.photoUrl}
                name={post.lastLiker.displayName}
                size={18}
              />
              <Text variant="bodySmall" numberOfLines={1} style={styles.likedByText}>
                Liked by <Text style={styles.strong}>{post.lastLiker.displayName}</Text>
                {post.stats.likeCount > 1 ? (
                  <Text>
                    {' and '}
                    <Text style={styles.strong}>
                      {post.stats.likeCount - 1}{' '}
                      {post.stats.likeCount - 1 === 1 ? 'other' : 'others'}
                    </Text>
                  </Text>
                ) : null}
              </Text>
            </Pressable>
          ) : (
            <Text
              variant="bodySmall"
              style={styles.strong}
              accessibilityRole="button"
              onPress={onPressLikes}
            >
              {post.stats.likeCount} {post.stats.likeCount === 1 ? 'like' : 'likes'}
            </Text>
          )
        ) : null}

        {/* Caption. */}
        {caption ? (
          <Text style={styles.caption}>
            <Text
              style={styles.strong}
              accessibilityRole="button"
              onPress={() => onPressAuthor(post.author.username)}
            >
              @{post.author.username}{' '}
            </Text>
            {shownCaption}
            {longCaption && !captionOpen ? (
              <Text tone="muted" accessibilityRole="button" onPress={() => setCaptionOpen(true)}>
                more
              </Text>
            ) : null}
          </Text>
        ) : null}

        {/* Comments. */}
        {(post.stats.commentCount ?? 0) > 0 ? (
          <Text
            variant="bodySmall"
            tone="muted"
            accessibilityRole="button"
            onPress={onPressComments}
            style={styles.viewComments}
          >
            {post.stats.commentCount === 1
              ? 'View 1 comment'
              : `View all ${post.stats.commentCount} comments`}
          </Text>
        ) : (
          <Text
            variant="bodySmall"
            tone="muted"
            accessibilityRole="button"
            onPress={onPressComments}
            style={styles.viewComments}
          >
            Add a comment
          </Text>
        )}

        {/* When. */}
        <Text variant="caption" tone="muted" style={styles.when}>
          {timeAgo(post.createdAt)}
        </Text>
      </View>

      <TaggedPieces
        listingIds={post.taggedListingIds ?? []}
        open={piecesOpen}
        onToggle={() => setPiecesOpen((v) => !v)}
        onOpenListing={onPressTag}
        onMessageSeller={onMessageSeller}
        isMine={isMine}
      />
    </View>
  );
}

/** One icon in the action row, with its count beside it when it has one. */
function Action({
  icon,
  label,
  count,
  tint,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  count?: number;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count}` : label}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Icon name={icon} size={iconSize.md} tint={tint} />
      {count ? (
        <Text variant="bodySmall" style={styles.actionCount}>
          {count > 999 ? `${Math.floor(count / 1000)}k` : count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Kept in step with the comment limit so both screens agree. */
export const MAX_COMMENT_LENGTH = LIMITS.commentBody.max;

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
    paddingVertical: spacing.sm,
  },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  username: { fontWeight: '600', flexShrink: 1 },
  more: { padding: spacing.xs },
  counter: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    // Deliberately a translucent black rather than a token: it has to
    // read on top of an arbitrary photo, which no surface colour does.
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
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
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: controls.minTapTarget,
  },
  actionPressed: { opacity: 0.5 },
  actionCount: { fontWeight: '600' },
  spacer: { flex: 1 },
  footer: { paddingHorizontal: spacing.md, gap: 3 },
  likedBy: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  likedByText: { flexShrink: 1 },
  strong: { fontWeight: '600' },
  caption: { marginTop: 2 },
  viewComments: { marginTop: 2 },
  when: { marginTop: 2 },
});
