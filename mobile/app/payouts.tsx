/**
 * Payouts & Payment Info.
 *
 * Payments are Phase 5 and deliberately paused, so there is nothing to
 * connect yet. This used to be the generic "Coming soon" card, which
 * reads as a screen that failed to load rather than a decision — and on
 * the one screen about money, "did this break?" is the wrong question
 * to leave someone with.
 *
 * So it says what is true: Loane is not handling money yet, students
 * settle between themselves, and here is what will land here when it
 * does.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { color, iconSize, radius, spacing } from '@loane/shared';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';

const WHAT_ARRIVES = [
  {
    icon: 'card-outline' as const,
    title: 'Get paid for your rentals',
    body: 'Connect a bank account once, and what you earn lands there automatically after each rental completes.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Protection on every piece',
    body: 'A hold on the renter’s card covers damage or a piece that does not come back, released when it does.',
  },
  {
    icon: 'receipt-outline' as const,
    title: 'Every payout in one place',
    body: 'What you earned, what is still pending, and when it reaches your account.',
  },
];

export default function Payouts() {
  const router = useRouter();

  return (
    <Screen flush scroll>
      <Header title="Payouts" onBack={() => router.back()} />

      <View style={styles.content}>
        <View style={styles.banner}>
          <Icon name="time-outline" size={iconSize.md} tint={color.text.primary} />
          <View style={styles.bannerText}>
            <Text variant="body" style={styles.strong}>
              Payments are coming soon
            </Text>
            <Text variant="bodySmall" tone="secondary">
              Loane isn’t handling money yet. For now, agree the amount in chat and settle it
              between yourselves however you normally would.
            </Text>
          </View>
        </View>

        <Text variant="label" tone="muted" style={styles.sectionLabel}>
          What lands here
        </Text>

        {WHAT_ARRIVES.map((item) => (
          <View key={item.title} style={styles.row}>
            <Icon name={item.icon} size={iconSize.md} tint={color.icon.muted} />
            <View style={styles.rowText}>
              <Text variant="bodySmall" style={styles.strong}>
                {item.title}
              </Text>
              <Text variant="caption" tone="muted" uppercase={false}>
                {item.body}
              </Text>
            </View>
          </View>
        ))}

        <Text variant="caption" tone="muted" uppercase={false} style={styles.footnote}>
          Nothing is required from you now. There is no account to connect yet.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.md,
    backgroundColor: color.surface.muted,
  },
  bannerText: { flex: 1, gap: spacing.xs },
  strong: { fontWeight: '600' },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
  rowText: { flex: 1, gap: 2 },
  footnote: { marginTop: spacing.lg },
});
