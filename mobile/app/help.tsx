/**
 * Help & Safety.
 *
 * Content straight from the mockups, including the emergency note — Loane
 * is a marketplace, not an emergency service, and saying so plainly is part
 * of being responsible about students meeting strangers.
 */

import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  brand,
  color,
  iconSize,
  spacing,
  type,
} from '@loane/shared';
import { Screen } from '../src/components/Screen';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
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
      <Header title="Help & Safety" onBack={() => router.back()} />
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
          <View style={styles.emergencyHeading}>
            <Icon name="warning-outline" size={iconSize.sm} tint={color.text.primary} />
            <Text style={styles.emergencyTitle}>In an emergency?</Text>
          </View>
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
    borderColor: color.border.default,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: type.body.size, fontWeight: '600', color: color.text.primary },
  cardBody: {
    fontSize: type.bodySmall.size,
    lineHeight: type.bodySmall.lineHeight,
    color: color.text.secondary,
    marginTop: 4,
  },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  link: { fontSize: type.body.size, color: color.text.primary },
  emergency: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.surface.muted,
    padding: spacing.md,
  },
  emergencyHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emergencyTitle: { fontSize: type.body.size, fontWeight: '600', color: color.text.primary },
  emergencyBody: {
    fontSize: type.bodySmall.size,
    lineHeight: type.bodySmall.lineHeight,
    color: color.text.secondary,
    marginTop: 4,
  },
});
