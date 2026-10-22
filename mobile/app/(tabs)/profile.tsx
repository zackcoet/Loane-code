/**
 * My Profile.
 *
 * Reads her live profile document, so an edit shows here the instant it
 * saves. Posts and Closet read real data; Reviews is empty until Phase 6.
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamilyFor, color, controls, spacing, type } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { IconButton } from '../../src/components/IconButton';
import { ProfileChecklist } from '../../src/components/ProfileChecklist';
import { ProfileHeader } from '../../src/components/ProfileHeader';
import { ProfileTabs } from '../../src/components/ProfileTabs';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/auth/AuthProvider';
import { useProfileChecklist } from '../../src/hooks/useProfileChecklist';
import { useProfilePhoto } from '../../src/hooks/useProfilePhoto';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';

export default function Profile() {
  const router = useRouter();
  // Live list: the pull is reassurance, see usePullToRefresh.
  const { refreshControl } = usePullToRefresh();
  const { profile } = useAuth();
  // Tapping your own avatar changes it there and then — no detour
  // through the edit form for the one thing people change most.
  const photo = useProfilePhoto();
  const checklist = useProfileChecklist();

  if (!profile) {
    return (
      <Screen>
        <EmptyState title="Loading your closet" />
      </Screen>
    );
  }

  return (
    <Screen flush>
      <View style={styles.header}>
        {/* The handle is centred on the SCREEN, not between the
            buttons. It used to be a flex child between a single
            hamburger on the left and two icons on the right, so it
            centred itself in the leftover space and sat one button's
            width off. Laying it over the full row fixes that, and it
            cannot be pushed around as buttons come and go.

            pointerEvents none so it never eats a tap meant for the
            hamburger underneath it. */}
        <View style={styles.titleLayer} pointerEvents="none">
          <Text style={styles.handle} numberOfLines={1}>
            @{profile.username}
          </Text>
        </View>

        <IconButton
          name="menu"
          onPress={() => router.push('/menu')}
          accessibilityLabel="Open menu"
        />
        <View style={styles.headerRight}>
          <IconButton
            name="settings-outline"
            onPress={() => router.push('/settings')}
            accessibilityLabel="Settings"
          />
          <IconButton
            name="add"
            accent
            onPress={() => router.push('/post-sheet')}
            accessibilityLabel="Create a post or listing"
          />
        </View>
      </View>

      <ScrollView
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <ProfileHeader
          user={profile}
          onPressPhoto={photo.change}
          onPressFollowers={() =>
            router.push({
              pathname: '/follow-list',
              params: { uid: profile.uid, side: 'followers' },
            })
          }
          onPressFollowing={() =>
            router.push({
              pathname: '/follow-list',
              params: { uid: profile.uid, side: 'following' },
            })
          }
          onPressRating={() => router.push({ pathname: '/reviews', params: { uid: profile.uid } })}
        >
          <Button
            label="Edit profile"
            variant="outline"
            onPress={() => router.push('/edit-profile')}
            style={styles.action}
          />
          {/* Her closet's calendar. Beside Edit profile because it is
              the other thing she opens her own profile to do. */}
          <Button
            label="Calendar"
            variant="outline"
            onPress={() => router.push('/closet-calendar')}
            style={styles.action}
          />
        </ProfileHeader>

        {/* Between who she is and what she has, which is the join a
            half-finished profile actually sits on. Collapsed to one
            line: her own profile opens with her, not with chores. */}
        {checklist.visible ? (
          <ProfileChecklist
            items={checklist.items}
            completed={checklist.completed}
            total={checklist.total}
            onDismiss={() => void checklist.dismiss()}
            onPressItem={(item) =>
              item.href ? router.push(item.href as never) : void photo.change()
            }
          />
        ) : null}

        <ProfileTabs uid={profile.uid} isMe />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: controls.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  titleLayer: {
    // Written out rather than StyleSheet.absoluteFillObject, which is
    // missing from the React Native typings in this project.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Padded by the width of the WIDER side — two tap targets — on
    // both sides, so a long handle truncates before it can reach a
    // button rather than sliding out from under the centre.
    paddingHorizontal: controls.minTapTarget * 2,
  },
  handle: {
    fontFamily: fontFamilyFor('500'),
    textAlign: 'center',
    fontSize: type.label.size,
    letterSpacing: type.label.letterSpacing,
    color: color.text.primary,
  },
  content: { paddingBottom: spacing.xxl },
  action: { flex: 1, height: controls.buttonHeightSmall },
});
