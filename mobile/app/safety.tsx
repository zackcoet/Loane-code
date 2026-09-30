/**
 * Help & Safety.
 *
 * Content straight from the mockups, including the emergency note — Loane
 * is a marketplace, not an emergency service, and saying so plainly is part
 * of being responsible about students meeting strangers.
 *
 * Built from the shared Text component rather than React Native's own
 * with hand-rolled styles, which is what the rest of the app does and
 * what CLAUDE.md asks for. This screen was the last one still inventing
 * its own type styles.
 */

import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { brand, color, iconSize, radius, spacing } from '@loane/shared';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';

const TIPS = [
  {
    title: 'Meet in public places',
    body: 'Hand off and return pieces somewhere busy on campus — a dining hall, a library lobby, the student center.',
  },
  {
    title: 'Verify the owner',
    body: 'Check her verified campus email, reviews, and listings before confirming a rental.',
  },
  {
    title: 'Inspect before you rent',
    body: 'Look at the item in person and confirm the size, condition and fit before paying.',
  },
  {
    title: 'Keep it in the app',
    body: 'Use Loane messages and checkout for every transaction so we can help if something goes wrong.',
  },
];

export default function Safety() {
  const router = useRouter();

  return (
    <Screen flush scroll>
      <Header title="Help & Safety" onBack={() => router.back()} />

      <View style={styles.content}>
        {TIPS.map((tip) => (
          <View key={tip.title} style={styles.card}>
            <Text variant="body" style={styles.cardTitle}>
              {tip.title}
            </Text>
            <Text variant="bodySmall" tone="secondary" style={styles.cardBody}>
              {tip.body}
            </Text>
          </View>
        ))}

        <Text variant="label" tone="muted" style={styles.sectionLabel}>
          Get support
        </Text>
        <View style={styles.card}>
          <Text
            variant="body"
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`mailto:${brand.supportEmail}`)}
          >
            {brand.supportEmail}
          </Text>
        </View>

        <View style={styles.emergency}>
          <View style={styles.emergencyHeading}>
            <Icon name="warning-outline" size={iconSize.sm} tint={color.text.primary} />
            <Text variant="body" style={styles.cardTitle}>
              In an emergency?
            </Text>
          </View>
          <Text variant="bodySmall" tone="secondary" style={styles.cardBody}>
            Contact your campus safety office or call 911. Loane is a marketplace, not an emergency
            service.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: {
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontWeight: '600' },
  cardBody: { marginTop: 4 },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  emergency: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.md,
    backgroundColor: color.surface.muted,
    padding: spacing.md,
  },
  emergencyHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
