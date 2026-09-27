/**
 * Tells a suspended student what happened.
 *
 * Without this, suspension just means every button quietly fails with
 * "You can't do that" and no explanation — which is both unkind and the
 * fastest route to an angry email nobody can answer. She keeps read
 * access; she is told why she cannot act, and where to appeal.
 */

import { Linking, StyleSheet, View } from 'react-native';
import { brand, color, spacing } from '@loane/shared';
import { Text } from './Text';
import { useAuth } from '../auth/AuthProvider';

export function SuspendedBanner() {
  const { profile } = useAuth();
  if (!profile || profile.status !== 'suspended') return null;

  return (
    <View style={styles.banner}>
      <Text variant="label" tone="inverse">
        Your account is suspended
      </Text>
      <Text variant="bodySmall" tone="inverse" style={styles.body}>
        {profile.suspendedReason ??
          'You can still browse, but you cannot post, list, rent or message.'}
      </Text>
      <Text
        variant="bodySmall"
        tone="inverse"
        accessibilityRole="link"
        onPress={() => void Linking.openURL(`mailto:${brand.supportEmail}`)}
        style={styles.link}
      >
        Appeal to {brand.supportEmail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: color.status.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  body: { marginTop: 2 },
  link: { marginTop: spacing.xs, textDecorationLine: 'underline' },
});
