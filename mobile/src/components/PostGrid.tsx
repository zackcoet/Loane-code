/**
 * A grid of looks. Used by Liked, by the Wishlist's Looks tab, and by
 * the Posts tab on a profile.
 */

import { useState } from 'react';
import {
  FlatList,
  Pressable,
  type RefreshControlProps,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { color, spacing, type Post } from '@loane/shared';
import { Text } from './Text';
import { ThumbImage } from './ThumbImage';
import { PeekPreview, type PeekItem } from './PeekPreview';

const COLUMNS = 2;

interface Props {
  posts: Post[];
  onPress: (postId: string) => void;
  header?: React.ReactElement | null;
  /** Pull to refresh, from usePullToRefresh. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function PostGrid({ posts, onPress, header, refreshControl }: Props) {
  const { width } = useWindowDimensions();
  const tileWidth = (width - spacing.md * (COLUMNS + 1)) / COLUMNS;
  // Press and hold a tile to see it big — see PeekPreview.
  const [peek, setPeek] = useState<PeekItem | null>(null);

  return (
    <>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        refreshControl={refreshControl}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPress(item.id)}
            onLongPress={() => setPeek({ kind: 'post', post: item })}
            accessibilityRole="button"
            accessibilityHint="Press and hold to preview"
            accessibilityLabel={item.caption || `Look by @${item.author.username}`}
            style={[styles.tile, { width: tileWidth }]}
          >
            {item.photos[0] ? (
              <ThumbImage uri={item.photos[0].url} style={styles.image} resizeMode="cover" />
            ) : null}
            {item.taggedListings.length > 0 ? (
              <View style={styles.badge}>
                <Text variant="caption" tone="inverse">
                  {item.taggedListings.length} tagged
                </Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
      <PeekPreview
        item={peek}
        // Liked and Saved looks, both reached from her profile.
        surface="profile"
        onClose={() => setPeek(null)}
        onOpen={(open) => {
          setPeek(null);
          if (open.kind === 'post') onPress(open.post.id);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  row: { gap: spacing.md },
  tile: {
    aspectRatio: 0.8,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.surface.muted,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: color.surface.inverse,
    opacity: 0.85,
  },
});
