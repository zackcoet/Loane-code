/**
 * My Rentals — active and past. Empty state only until Phase 4.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  color,
  spacing,
  type,
} from '@loane/shared';
import { Screen } from '../src/components/Screen';
import { Header } from '../src/components/Header';

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
      <Header title="My Rentals" onBack={() => router.back()} />
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
    borderBottomColor: color.border.default,
  },
  sectionTitle: {
    fontSize: type.label.size,
    letterSpacing: type.label.letterSpacing,
    textTransform: 'uppercase',
    color: color.text.secondary,
  },
  sectionBody: {
    marginTop: spacing.md,
    fontSize: type.body.size,
    color: color.text.muted,
    textAlign: 'center',
  },
});
