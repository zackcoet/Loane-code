/**
 * A grid of looks. Used by Liked, by the Wishlist's Looks tab, and by
 * the Posts tab on a profile.
 */

import { FlatList, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { color, spacing, type Post } from '@loane/shared';
import { Text } from './Text';

const COLUMNS = 2;

interface Props {
  posts: Post[];
  onPress: (postId: string) => void;
  header?: React.ReactElement | null;
}

export function PostGrid({ posts, onPress, header }: Props) {
  const { width } = useWindowDimensions();
  const tileWidth = (width - spacing.md * (COLUMNS + 1)) / COLUMNS;

  return (
    <FlatList
      data={posts}
      keyExtractor={(post) => post.id}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onPress(item.id)}
          accessibilityRole="button"
          accessibilityLabel={item.caption || `Look by @${item.author.username}`}
          style={[styles.tile, { width: tileWidth }]}
        >
          {item.photos[0] ? (
            <Image source={{ uri: item.photos[0].url }} style={styles.image} resizeMode="cover" />
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
