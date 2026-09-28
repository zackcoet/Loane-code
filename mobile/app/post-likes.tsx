/**
 * Who liked a look.
 *
 * Reached by tapping the "Liked by Harper and 12 others" line under a
 * post. Tapping anyone here opens her closet, which is the only reason
 * anybody opens this list.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { color, spacing } from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { usePostLikers } from '../src/hooks/usePostLikers';
import { useHiddenUids } from '../src/hooks/useBlocks';

export default function PostLikes() {
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { people, loading } = usePostLikers(postId);
  const hidden = useHiddenUids();

  // The on-device half of blocking: someone she blocked is not in the
  // list. See docs/security.md.
  const visible = people.filter((p) => !hidden.has(p.uid));

  return (
    <Screen flush>
      <Header title="Likes" onBack={() => router.back()} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : visible.length === 0 ? (
        <EmptyState title="No likes yet" body="Be the first to like this look." />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p) => p.uid}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/u/${item.username}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open @${item.username}'s closet`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Avatar url={item.photoUrl} name={item.displayName} size={44} />
              <View style={styles.text}>
                <Text variant="bodySmall" style={styles.strong} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  @{item.username}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  pressed: { opacity: 0.6 },
  text: { flex: 1 },
  strong: { fontWeight: '600' },
});
