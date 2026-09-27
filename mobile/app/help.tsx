/**
 * Help & Safety.
 *
 * Content straight from the mockups, including the emergency note — Loane
 * is a marketplace, not an emergency service, and saying so plainly is part
 * of being responsible about students meeting strangers.
 */

import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { brand, colors, spacing, typography } from '@loane/shared';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { text } from '../src/theme';

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

export default function Help() {
  const router = useRouter();

  return (
    <Screen flush>
      <ScreenHeader title="Help & Safety" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {TIPS.map((tip) => (
          <View key={tip.title} style={styles.card}>
            <Text style={styles.cardTitle}>{tip.title}</Text>
            <Text style={styles.cardBody}>{tip.body}</Text>
          </View>
        ))}

        <Text style={[text.label, styles.sectionLabel]}>Get support</Text>
        <View style={styles.card}>
          <Text
            style={styles.link}
            onPress={() => Linking.openURL(`mailto:${brand.supportEmail}`)}
            accessibilityRole="link"
          >
            {brand.supportEmail}
          </Text>
        </View>

        <View style={styles.emergency}>
          <Text style={styles.emergencyTitle}>⚠  In an emergency?</Text>
          <Text style={styles.emergencyBody}>
            Contact your campus safety office or call 911. Loane is a marketplace, not an emergency
            service.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: typography.body.size, fontWeight: '600', color: colors.textPrimary },
  cardBody: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.textSecondary,
    marginTop: 4,
  },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  link: { fontSize: typography.body.size, color: colors.textPrimary },
  emergency: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  emergencyTitle: { fontSize: typography.body.size, fontWeight: '600', color: colors.ink },
  emergencyBody: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
