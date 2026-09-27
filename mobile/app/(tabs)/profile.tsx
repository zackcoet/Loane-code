/**
 * My Profile.
 *
 * Reads her live profile document, so an edit shows here the instant it
 * saves. Posts and Closet read real data; Reviews is empty until Phase 6.
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, controls, spacing, typography } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { IconButton } from '../../src/components/IconButton';
import { ProfileHeader } from '../../src/components/ProfileHeader';
import { ProfileTabs } from '../../src/components/ProfileTabs';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/auth/AuthProvider';

export default function Profile() {
  const router = useRouter();
  const { profile } = useAuth();

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
        <View style={styles.headerSpacer} />
        <Text style={styles.handle} numberOfLines={1}>
          @{profile.username}
        </Text>
        <IconButton
          glyph="⚙"
          onPress={() => router.push('/settings')}
          accessibilityLabel="Account settings"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ProfileHeader user={profile}>
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
  headerSpacer: { width: controls.minTapTarget },
  handle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textPrimary,
  },
  content: { paddingBottom: spacing.xxl },
  action: { flex: 1, height: controls.buttonHeightSmall },
});
