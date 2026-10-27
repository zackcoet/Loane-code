/**
 * Muted — whose looks she has hidden from her feed, and how to undo it.
 *
 * Muting is undone from the person's profile too, but a muted person's
 * looks are exactly what she no longer sees, so the profile is hard to
 * find again. This list is the reliable way back.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { color, controls, spacing, type User } from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { LoadError } from '../src/components/LoadError';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { setUserMuted, useMutedUids } from '../src/hooks/useMuted';
import { usePeopleByUid } from '../src/hooks/usePeopleByUid';

export default function MutedUsers() {
  const router = useRouter();
  const { profile } = useAuth();
  const muted = useMutedUids();
  const { people, loading, failed, retry } = usePeopleByUid(muted.list, !muted.loading);
  const [busy, setBusy] = useState<string | null>(null);

  // Either half failing means we can't honestly say who is muted.
  const couldNotLoad = muted.failed || failed;
  const tryAgain = () => {
    if (muted.failed) muted.retry();
    else retry();
  };

  // No confirm: unmuting only brings her looks back, and is one tap to redo.
  const unmute = async (user: User) => {
    if (!profile) return;
    setBusy(user.uid);
    try {
      await setUserMuted(profile.uid, user.uid, false);
    } catch {
      Alert.alert('Loane', 'Could not unmute right now. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen flush>
      <Header title="Muted" onBack={() => router.back()} />

      {couldNotLoad ? (
        <LoadError what="your muted list" onRetry={tryAgain} />
      ) : loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : people.length === 0 ? (
        <EmptyState
          title="Nobody muted"
          body="Mute someone from the … on her look or profile and her looks leave your feed. She won't be told."
        />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(u) => u.uid}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text variant="bodySmall" tone="secondary" style={styles.note}>
              Their looks don&apos;t show in your feed. They aren&apos;t told, and you can still
              message, rent and visit their closets.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                onPress={() => router.push(`/u/${item.username}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open @${item.username}'s closet`}
                style={styles.person}
              >
                <Avatar url={item.photoUrl} name={item.displayName} size={44} />
                <View style={styles.rowText}>
                  <Text numberOfLines={1}>@{item.username}</Text>
                  <Text variant="bodySmall" tone="muted">
                    {item.displayName}
                  </Text>
                </View>
              </Pressable>
              <Button
                label="Unmute"
                variant="outline"
                loading={busy === item.uid}
                onPress={() => void unmute(item)}
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
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: controls.minTapTarget },
  rowText: { flex: 1, marginLeft: spacing.md },
  button: { height: controls.buttonHeightSmall, paddingHorizontal: spacing.md },
});
