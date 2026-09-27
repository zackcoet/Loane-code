/**
 * Another student's profile and closet.
 *
 * Reached by tapping a name or photo anywhere in the app: `/u/ellacloset`.
 *
 * Follow and Unfollow go through Cloud Functions — the app cannot write
 * the follow edge or anyone's follower count, because a follower count
 * anyone can edit is not a trust signal.
 */

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  color,
  controls,
  spacing,
} from '@loane/shared';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { ProfileHeader } from '../../src/components/ProfileHeader';
import { ProfileTabs } from '../../src/components/ProfileTabs';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { useAuth } from '../../src/auth/AuthProvider';
import { useIsFollowing, useProfileByUsername } from '../../src/hooks/useProfile';
import { followUser, unfollowUser } from '../../src/firebase/callables';
import { callableErrorMessage } from '../../src/firebase/errors';
import { logEvent } from '../../src/analytics/events';
import { useOpenChat } from '../../src/hooks/useOpenChat';
import { useHiddenUids } from '../../src/hooks/useBlocks';
import { IconButton } from '../../src/components/IconButton';
import { ReportSheet } from '../../src/components/ReportSheet';

export default function OtherProfile() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { profile: me } = useAuth();

  const { user, loading, notFound } = useProfileByUsername(username);
  const { following } = useIsFollowing(user?.uid);
  const chat = useOpenChat();
  const [reporting, setReporting] = useState(false);
  const hidden = useHiddenUids();
  const [busy, setBusy] = useState(false);

  const isMe = Boolean(me && user && me.uid === user.uid);

  useEffect(() => {
    if (user) {
      logEvent('profile_view', {
        surface: 'profile',
        targetType: 'user',
        targetId: user.uid,
      });
    }
  }, [user]);

  const onToggleFollow = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (following) {
        await unfollowUser({ uid: user.uid });
        logEvent('unfollow', { surface: 'profile', targetType: 'user', targetId: user.uid });
      } else {
        await followUser({ uid: user.uid });
        logEvent('follow', { surface: 'profile', targetType: 'user', targetId: user.uid });
      }
    } catch (err) {
      Alert.alert('Loane', callableErrorMessage(err, 'That did not work. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen flush>
        <Header title="" onBack={() => router.back()} />
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      </Screen>
    );
  }

  // Either of us blocked the other: her profile is simply not there.
  // No banner, no explanation — a quiet boundary, not a confrontation.
  if (user && hidden.has(user.uid)) {
    return (
      <Screen flush>
        <Header title="" onBack={() => router.back()} />
        <EmptyState title="Closet not found" body="This closet isn't available." />
      </Screen>
    );
  }

  if (notFound || !user) {
    return (
      <Screen flush>
        <Header title="" onBack={() => router.back()} />
        <EmptyState
          title="Closet not found"
          body={`We couldn't find @${username ?? ''} on Loane.`}
        />
      </Screen>
    );
  }

  return (
    <Screen flush>
      <Header
        title={`@${user.username}`}
        onBack={() => router.back()}
        right={
          isMe ? null : (
            <IconButton
              name="ellipsis-horizontal"
              accessibilityLabel="Report or block"
              onPress={() => setReporting(true)}
            />
          )
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ProfileHeader user={user}>
          {isMe ? (
            <Button
              label="Edit profile"
              variant="outline"
              onPress={() => router.push('/edit-profile')}
              style={styles.action}
            />
          ) : (
            <>
              <Button
                label={following ? 'Following' : 'Follow'}
                variant={following ? 'outline' : 'primary'}
                loading={busy}
                onPress={onToggleFollow}
                style={styles.action}
              />
              <Button
                label="Message"
                variant="outline"
                loading={chat.opening}
                onPress={() => void chat.open(user.uid)}
                style={styles.action}
              />
            </>
          )}
        </ProfileHeader>

        <ProfileTabs uid={user.uid} isMe={isMe} />
      </ScrollView>

      <ReportSheet
        visible={reporting}
        targetType="user"
        targetId={user.uid}
        targetUid={user.uid}
        targetLabel={`@${user.username}`}
        onClose={() => setReporting(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: spacing.xxl },
  action: { flex: 1, height: controls.buttonHeightSmall },
});
