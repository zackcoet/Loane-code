/**
 * Pick the occasions a look is for.
 *
 * Several, not one. A going-out dress is often also a date-function
 * dress, and occasions are how Discover is browsed — forcing a single
 * choice would hide the piece from half the people looking for it.
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { OCCASIONS, OCCASION_LABELS, color, spacing, type Occasion } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { Header } from '../../src/components/Header';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { usePostDraft } from '../../src/post/postDraft';

export default function PostOccasions() {
  const router = useRouter();
  const draft = usePostDraft();

  const toggle = (occasion: Occasion) => {
    draft.setOccasions(
      draft.occasions.includes(occasion)
        ? draft.occasions.filter((o) => o !== occasion)
        : [...draft.occasions, occasion],
    );
  };

  return (
    <Screen flush>
      <Header title="Occasion" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="bodySmall" tone="secondary" style={styles.explainer}>
          Pick as many as fit. This is how people find a look when they are shopping for a
          particular night.
        </Text>
        <View style={styles.chips}>
          {OCCASIONS.map((occasion) => (
            <Chip
              key={occasion}
              label={OCCASION_LABELS[occasion]}
              active={draft.occasions.includes(occasion)}
              onPress={() => toggle(occasion)}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Done" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  explainer: { marginBottom: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    paddingTop: spacing.md,
  },
});
