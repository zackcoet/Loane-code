/**
 * Invite Friends.
 *
 * Loane only works if enough of one campus is on it, so inviting is not
 * a nice-to-have — it is the growth loop. The share sheet is the whole
 * feature: it already knows her group chats, and a girl forwarding this
 * into her sorority's iMessage thread is worth more than any referral
 * screen we could build.
 *
 * The sheet opens as soon as she lands here, because tapping "Invite
 * Friends" means she has already decided. The screen behind it shows
 * the same message and a button to open it again, so cancelling leaves
 * her somewhere that makes sense rather than on a blank page.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Share, StyleSheet, View } from 'react-native';
import { brand, color, radius, spacing } from '@loane/shared';
import { Button } from '../src/components/Button';
import { Header } from '../src/components/Header';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useCampusName } from '../src/hooks/useCampus';
import { logEvent } from '../src/analytics/events';

export default function InviteFriends() {
  const router = useRouter();
  const { profile } = useAuth();
  const { name: campusName } = useCampusName(profile?.campusId);
  // The sheet opens once on arrival, not on every re-render.
  const opened = useRef(false);

  const message = `Come share closets with me on Loane — it's rentals from girls at ${
    campusName ?? 'our school'
  }. Rent something for gameday instead of buying it.\n\n${brand.website}`;

  const share = useCallback(async () => {
    try {
      const result = await Share.share({ message });
      if (result.action === Share.sharedAction) {
        logEvent('invite_shared', { surface: 'other', targetType: null, targetId: null });
      }
    } catch {
      Alert.alert('Loane', 'Could not open the share sheet.');
    }
  }, [message]);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void share();
  }, [share]);

  return (
    <Screen flush scroll>
      <Header title="Invite Friends" onBack={() => router.back()} />

      <View style={styles.content}>
        <Text variant="body">
          Loane works when enough of your campus is on it. Send this to a group chat.
        </Text>

        <View style={styles.preview}>
          <Text variant="bodySmall">{message}</Text>
        </View>

        <Button label="Share invite" onPress={() => void share()} />

        <Text variant="caption" tone="muted" uppercase={false}>
          The share sheet can copy it too, so there is no separate copy button here.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  preview: {
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.md,
    backgroundColor: color.surface.muted,
    padding: spacing.md,
  },
});
