/**
 * My Rentals — active and past. Empty state only until Phase 4.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@loane/shared';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

export default function MyRentals() {
  const router = useRouter();

  return (
    <Screen flush>
      <ScreenHeader title="My Rentals" onBack={() => router.back()} />
      {/* TODO-PHASE4: real bookings. */}
      <Section title="Active" body="No active rentals. Reserved pieces will appear here." />
      <Section title="Past" body="No past rentals." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  sectionBody: {
    marginTop: spacing.md,
    fontSize: typography.body.size,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
