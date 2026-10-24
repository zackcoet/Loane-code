/**
 * Another student's profile and closet.
 *
 * Reached by tapping a name or photo anywhere in the app: `/u/ellacloset`.
 * A link that knows her account id adds it — `/u/ellacloset?uid=…` — so it
 * keeps working after she changes her username (see useProfileByUsername).
 *
 * Follow and Unfollow go through Cloud Functions — the app cannot write
 * the follow edge or anyone's follower count, because a follower count
 * anyone can edit is not a trust signal.
 */

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SkeletonProfile } from '../../src/components/Skeleton';
import { controls, isDeletedAccount, spacing } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { ProfileHeader } from '../../src/components/ProfileHeader';
import { ProfileTabs } from '../../src/components/ProfileTabs';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { LoadError } from '../../src/components/LoadError';
import { useAuth } from '../../src/auth/AuthProvider';
import { useIsFollowing, useProfileByUsername } from '../../src/hooks/useProfile';
import { followUser, unfollowUser } from '../../src/firebase/callables';
import { hapticFollow } from '../../src/haptics';
import { callableErrorMessage } from '../../src/firebase/errors';
import { logEvent } from '../../src/analytics/events';
import { useOpenChat } from '../../src/hooks/useOpenChat';
import { useHiddenUids } from '../../src/hooks/useBlocks';
import { useReportOrBlock } from '../../src/hooks/useReportOrBlock';
import { IconButton } from '../../src/components/IconButton';
import { ReportSheet } from '../../src/components/ReportSheet';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';

export default function OtherProfile() {
  const router = useRouter();
  // Live list: the pull is reassurance, see usePullToRefresh.
  const { refreshControl } = usePullToRefresh();
  const { username, from, uid } = useLocalSearchParams<{
    username: string;
    from?: string;
    uid?: string;
  }>();
  // Where she tapped through from, so the feed algorithm can tell "opened
  // her profile from a look" apart from a search. Only known values, so a
  // hand-typed link cannot put arbitrary text in the event.
  const cameFrom = from === 'feed' || from === 'suggested' ? from : 'other';
  const { profile: me } = useAuth();

  const { user, loading, notFound, failed, retry } = useProfileByUsername(username, uid);
  const { following } = useIsFollowing(user?.uid);
  const chat = useOpenChat();
  const [reporting, setReporting] = useState(false);
  /*
    Report OR block. The "…" was labelled "Report or block" and only
    reported — the label was right and the menu was missing.
  */
  const reportOrBlock = useReportOrBlock({
    uid: user?.uid ?? '',
    username: user?.username ?? '',
    onReport: () => setReporting(true),
    // Her content is already hidden from her, so there is nothing
    // left on this screen to look at.
    onBlocked: () => router.back(),
    onShare: () => {
      if (user) router.push({ pathname: '/send-post', params: { uid: user.uid } });
    },
  });
  const hidden = useHiddenUids();
  const [busy, setBusy] = useState(false);

  const isMe = Boolean(me && user && me.uid === user.uid);

  useEffect(() => {
    if (user) {
      logEvent('profile_view', {
        surface: 'profile',
        targetType: 'user',
        targetId: user.uid,
        meta: { from: cameFrom },
      });
    }
  }, [user, cameFrom]);

  const onToggleFollow = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (following) {
        await unfollowUser({ uid: user.uid });
        logEvent('unfollow', {
          surface: 'profile',
          targetType: 'user',
          targetId: user.uid,
          meta: { from: cameFrom },
        });
      } else {
        hapticFollow();
        await followUser({ uid: user.uid });
        logEvent('follow', {
          surface: 'profile',
          targetType: 'user',
          targetId: user.uid,
          meta: { from: cameFrom },
        });
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
        <SkeletonProfile />
      </Screen>
    );
  }

  if (failed) {
    return (
      <Screen flush>
        <Header title="" onBack={() => router.back()} />
        <LoadError what="this closet" onRetry={retry} />
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
          body={username ? `We couldn't find @${username} on Loane.` : "We couldn't find this closet."}
          actionLabel="Find people"
          onAction={() => router.push('/find-friends')}
        />
      </Screen>
    );
  }

  // Reached from an old link or notification after she left Loane.
  if (isDeletedAccount(user)) {
    return (
      <Screen flush>
        <Header title="" onBack={() => router.back()} />
        <EmptyState title="Account deleted" body="This person has left Loane." />
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
              accessibilityLabel="More: share, report or block"
              onPress={reportOrBlock.open}
            />
          )
        }
      />

      <ScrollView
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <ProfileHeader
          user={user}
          onPressFollowers={() =>
            router.push({ pathname: '/follow-list', params: { uid: user.uid, side: 'followers' } })
          }
          onPressFollowing={() =>
            router.push({ pathname: '/follow-list', params: { uid: user.uid, side: 'following' } })
          }
          onPressRating={() => router.push({ pathname: '/reviews', params: { uid: user.uid } })}
        >
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
  content: { paddingBottom: spacing.xxl },
  action: { flex: 1, height: controls.buttonHeightSmall },
});
