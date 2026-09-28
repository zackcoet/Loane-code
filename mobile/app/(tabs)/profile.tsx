/**
 * My Profile.
 *
 * Reads her live profile document, so an edit shows here the instant it
 * saves. Posts and Closet read real data; Reviews is empty until Phase 6.
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  color,
  controls,
  spacing,
  type,
} from '@loane/shared';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { IconButton } from '../../src/components/IconButton';
import { ProfileHeader } from '../../src/components/ProfileHeader';
import { ProfileTabs } from '../../src/components/ProfileTabs';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/auth/AuthProvider';
import { useProfilePhoto } from '../../src/hooks/useProfilePhoto';

export default function Profile() {
  const router = useRouter();
  const { profile } = useAuth();
  // Tapping your own avatar changes it there and then — no detour
  // through the edit form for the one thing people change most.
  const photo = useProfilePhoto();

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
        <IconButton
          name="menu"
          onPress={() => router.push('/menu')}
          accessibilityLabel="Open menu"
        />
        <Text style={styles.handle} numberOfLines={1}>
          @{profile.username}
        </Text>
        <View style={styles.headerRight}>
          <IconButton
            name="settings-outline"
            onPress={() => router.push('/settings')}
            accessibilityLabel="Settings"
          />
          <IconButton
            name="add"
            onPress={() => router.push('/post-sheet')}
            accessibilityLabel="Create a post or listing"
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
          onPressRating={() =>
            router.push({ pathname: '/reviews', params: { uid: profile.uid } })
          }
        >
          <Button
            label="Edit profile"
            variant="outline"
            onPress={() => router.push('/edit-profile')}
            style={styles.action}
          />
        </ProfileHeader>

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
  handle: {
    flex: 1,
    textAlign: 'center',
    fontSize: type.label.size,
    letterSpacing: type.label.letterSpacing,
    color: color.text.primary,
  },
  content: { paddingBottom: spacing.xxl },
  action: { flex: 1, height: controls.buttonHeightSmall },
});
