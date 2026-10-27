/**
 * Blocked — who she has blocked, and how to undo it.
 *
 * This screen exists because blocking without a way back is a trap: the
 * only route to someone's profile is through content you can no longer
 * see, so an accidental block used to be permanent.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';
import { color, controls, spacing, type User } from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { LoadError } from '../src/components/LoadError';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useBlockedUids } from '../src/hooks/useBlocks';
import { usePeopleByUid } from '../src/hooks/usePeopleByUid';
import { unblockUser } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { logEvent } from '../src/analytics/events';

export default function BlockedUsers() {
  const router = useRouter();
  const blocked = useBlockedUids();
  const { people, loading, failed, retry } = usePeopleByUid(blocked.list, !blocked.loading);
  const [busy, setBusy] = useState<string | null>(null);

  // Either half failing means we can't honestly say who is blocked.
  const couldNotLoad = blocked.failed || failed;
  const tryAgain = () => {
    if (blocked.failed) blocked.retry();
    else retry();
  };

  const unblock = (user: User) => {
    Alert.alert(`Unblock @${user.username}?`, 'You will see each other on Loane again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          setBusy(user.uid);
          try {
            await unblockUser({ uid: user.uid });
            logEvent('user_unblocked', {
              surface: 'other',
              targetType: 'user',
              targetId: user.uid,
            });
          } catch (err) {
            Alert.alert('Loane', callableErrorMessage(err, 'Could not unblock her.'));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <Screen flush>
      <Header title="Blocked" onBack={() => router.back()} />

      {couldNotLoad ? (
        <LoadError what="your blocked list" onRetry={tryAgain} />
      ) : loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : people.length === 0 ? (
        <EmptyState
          title="Nobody blocked"
          body="If you block someone, she shows up here so you can undo it."
        />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(u) => u.uid}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text variant="bodySmall" tone="secondary" style={styles.note}>
              You can&apos;t see each other, message, or rent from each other.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar url={item.photoUrl} name={item.displayName} size={44} />
              <View style={styles.rowText}>
                <Text numberOfLines={1}>@{item.username}</Text>
                <Text variant="bodySmall" tone="muted">
                  {item.displayName}
                </Text>
              </View>
              <Button
                label="Unblock"
                variant="outline"
                loading={busy === item.uid}
                onPress={() => unblock(item)}
                style={styles.button}
              />
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  note: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: controls.minTapTarget,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  rowText: { flex: 1, marginLeft: spacing.md },
  button: { height: controls.buttonHeightSmall, paddingHorizontal: spacing.md },
});
