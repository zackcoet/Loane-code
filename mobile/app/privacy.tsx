/**
 * Privacy.
 *
 * Honest about what is and isn't private on Loane today, plus the one
 * real switch so far: whether her chats say "Seen".
 */

import { useRouter } from 'expo-router';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { fonts, fontFamilyFor, brand, color, controls, spacing, type } from '@loane/shared';
import { Screen } from '../src/components/Screen';
import { Header } from '../src/components/Header';
import { useUserSettings } from '../src/hooks/useUserSettings';

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
    body: "Block someone from her profile and you won't see each other, message, or rent from each other. Manage it under Settings → Blocked.",
  },
];

export default function Privacy() {
  const router = useRouter();
  const { settings, loading, save } = useUserSettings();
  const receiptsOn = settings?.messaging?.readReceipts ?? true;

  return (
    <Screen flush>
      <Header title="Privacy" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text maxFontSizeMultiplier={controls.maxFontScale} style={styles.cardTitle}>
              Show read receipts
            </Text>
            <Text maxFontSizeMultiplier={controls.maxFontScale} style={styles.cardBody}>
              When this is off, people won&apos;t see when you&apos;ve read their messages — and you
              won&apos;t see theirs.
            </Text>
          </View>
          <Switch
            value={receiptsOn}
            disabled={loading}
            accessibilityLabel="Show read receipts"
            onValueChange={(next) =>
              void save({ messaging: { readReceipts: next } }).catch(() =>
                Alert.alert('Loane', 'Could not save that. Try again.'),
              )
            }
            trackColor={{ true: color.icon.default, false: color.border.default }}
          />
        </View>

        {FACTS.map((fact) => (
          <View key={fact.title} style={styles.card}>
            <Text maxFontSizeMultiplier={controls.maxFontScale} style={styles.cardTitle}>
              {fact.title}
            </Text>
            <Text maxFontSizeMultiplier={controls.maxFontScale} style={styles.cardBody}>
              {fact.body}
            </Text>
          </View>
        ))}

        <Text
          maxFontSizeMultiplier={controls.maxFontScale}
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: controls.minTapTarget + 16,
    borderWidth: 1,
    borderColor: color.border.default,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  switchText: { flex: 1, marginRight: spacing.md },
  card: {
    borderWidth: 1,
    borderColor: color.border.default,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: fontFamilyFor('600'),
    fontSize: type.body.size,
    fontWeight: '600',
    color: color.text.primary,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: type.bodySmall.size,
    lineHeight: type.bodySmall.lineHeight,
    color: color.text.secondary,
    marginTop: 4,
  },
  link: {
    fontFamily: fonts.body,
    marginTop: spacing.lg,
    fontSize: type.body.size,
    color: color.text.primary,
    textDecorationLine: 'underline',
  },
});
