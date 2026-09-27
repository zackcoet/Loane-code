/**
 * Privacy.
 *
 * Honest about what is and isn't private on Loane today. Real controls —
 * blocking, a private closet — arrive in Phase 6; saying so is better than
 * showing switches that do nothing.
 */

import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { brand, colors, spacing, typography } from '@loane/shared';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';

const FACTS = [
  {
    title: 'Who can see your profile',
    body: 'Any verified student can see your name, username, photo, bio, sizes, closet and reviews.',
  },
  {
    title: 'What stays private',
    body: 'Your email address, phone number and handoff notes are never shown to other students.',
  },
  {
    title: 'Your campus email',
    body: 'Used only to confirm you belong to your school. It is never displayed on your profile.',
  },
  {
    title: 'Blocking',
    body: 'Blocking another student is coming soon. For now, report anyone who makes you uncomfortable.',
  },
];

export default function Privacy() {
  const router = useRouter();

  return (
    <Screen flush>
      <ScreenHeader title="Privacy" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {FACTS.map((fact) => (
          <View key={fact.title} style={styles.card}>
            <Text style={styles.cardTitle}>{fact.title}</Text>
            <Text style={styles.cardBody}>{fact.body}</Text>
          </View>
        ))}

        <Text
          style={styles.link}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`${brand.website}/privacy`)}
        >
          Read the full privacy policy
        </Text>
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
  link: {
    marginTop: spacing.lg,
    fontSize: typography.body.size,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
});
