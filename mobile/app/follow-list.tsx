/**
 * Followers and Following.
 *
 * One screen for both, because they are the same list with a different
 * query behind them and splitting them would mean two files that have
 * to be kept looking identical.
 *
 * On her OWN Following list every row carries an Unfollow button. That
 * is the only place unfollowing in bulk makes sense, and hunting for it
 * one profile at a time is what makes people give up and keep a feed
 * they have outgrown.
 */

import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { color, radius, spacing } from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useFollowList } from '../src/hooks/useFollowing';
import { useHiddenUids } from '../src/hooks/useBlocks';
import { unfollowUser } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';

export default function FollowListScreen() {
  const router = useRouter();
  const { uid, side, name } = useLocalSearchParams<{
    uid: string;
    side: 'followers' | 'following';
    name?: string;
  }>();
  const { profile } = useAuth();
  const { people, loading } = useFollowList(uid, side === 'followers' ? 'followers' : 'following');
  const hidden = useHiddenUids();
  const [working, setWorking] = useState<string | null>(null);

  const isMine = profile?.uid === uid;
  const canUnfollow = isMine && side === 'following';
  const visible = people.filter((p) => !hidden.has(p.uid));

  const onUnfollow = (targetUid: string, username: string) => {
    Alert.alert(`Unfollow @${username}?`, 'Her looks will stop showing in your Following feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unfollow',
        style: 'destructive',
        onPress: () => {
          setWorking(targetUid);
          void unfollowUser({ uid: targetUid })
            .catch((err: unknown) =>
              Alert.alert('Loane', callableErrorMessage(err, 'Could not unfollow her.')),
            )
            .finally(() => setWorking(null));
        },
      },
    ]);
  };

  const title = side === 'followers' ? 'Followers' : 'Following';

  return (
    <Screen flush>
      <Header title={name ? `${name} · ${title}` : title} onBack={() => router.back()} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : visible.length === 0 ? (
        <EmptyState
          title={side === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          body={
            side === 'followers'
              ? 'People who follow this closet show up here.'
              : 'Closets followed from here show up in the Following feed.'
          }
          actionLabel={isMine && side === 'following' ? 'Find closets to follow' : undefined}
          onAction={
            isMine && side === 'following'
              ? () => router.push('/(tabs)/discover')
              : undefined
          }
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p) => p.uid}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                onPress={() => router.push(`/u/${item.username}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open @${item.username}'s closet`}
                style={({ pressed }) => [styles.who, pressed && styles.pressed]}
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

              {canUnfollow ? (
                <Pressable
                  onPress={() => onUnfollow(item.uid, item.username)}
                  disabled={working === item.uid}
                  accessibilityRole="button"
                  accessibilityLabel={`Unfollow @${item.username}`}
                  style={({ pressed }) => [styles.unfollow, pressed && styles.pressed]}
                >
                  <Text variant="caption">
                    {working === item.uid ? 'Working' : 'Unfollow'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.6 },
  text: { flex: 1 },
  strong: { fontWeight: '600' },
  unfollow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.md,
  },
});
