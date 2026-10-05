/**
 * Step 3 of posting a look — caption, then rows for everything else.
 *
 * Instagram's "New post" screen, and for the same reason: a caption is
 * the only thing most people fill in, so it gets the top of the screen
 * and everything optional becomes a row you may ignore.
 *
 * The old screen stacked photos, caption, occasion chips and a tagging
 * hint into one scroll, which is how "Remove photo" ended up below the
 * fold. Rows cannot do that.
 */

import { useRouter } from 'expo-router';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LIMITS, OCCASION_LABELS, color, controls, radius, spacing } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Header } from '../../src/components/Header';
import { Icon } from '../../src/components/Icon';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { usePostDraft } from '../../src/post/postDraft';

export default function PostDetails() {
  const router = useRouter();
  const draft = usePostDraft();
  const cover = draft.photos[0];

  // Reloaded straight onto this screen, or the draft was cleared behind
  // us. There is nothing to describe, so go back to the start.
  if (!cover) {
    return (
      <Screen>
        <Header title="New post" onBack={() => router.back()} />
        <View style={styles.empty}>
          <Text variant="bodySmall" tone="secondary">
            This draft is gone. Start again from the + button.
          </Text>
        </View>
      </Screen>
    );
  }

  const occasionLabel =
    draft.occasions.length === 0
      ? null
      : draft.occasions.length === 1
        ? OCCASION_LABELS[draft.occasions[0]!]
        : `${OCCASION_LABELS[draft.occasions[0]!]} +${draft.occasions.length - 1}`;

  return (
    <Screen flush>
      <Header title="New post" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.captionRow}>
            {/* Tapping the thumbnail goes back to the photos, which is
                where Instagram puts that affordance too. */}
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Edit photos"
            >
              <Image source={{ uri: cover.picked.uri }} style={styles.thumb} />
              {draft.photos.length > 1 ? (
                <View style={styles.countBadge}>
                  <Text variant="caption" style={styles.countBadgeText} uppercase={false}>
                    {draft.photos.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <View style={styles.captionField}>
              <Input
                value={draft.caption}
                onChangeText={draft.setCaption}
                placeholder="Write a caption…"
                multiline
                maxLength={LIMITS.postCaption.max}
                style={styles.captionInput}
              />
            </View>
          </View>

          <View style={styles.rows}>
            <Row
              label="Tag pieces"
              value={draft.tagCount > 0 ? String(draft.tagCount) : null}
              onPress={() => router.push('/new-post/tag')}
            />
            <Row
              label="Occasion"
              value={occasionLabel}
              onPress={() => router.push('/new-post/occasions')}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Preview" onPress={() => router.push('/new-post/preview')} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** One tappable row: label on the left, what it is set to on the right. */
function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? (
        <Text variant="bodySmall" tone="secondary" style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      <Icon name="chevron-forward" size={20} tint={color.text.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  captionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  thumb: {
    width: controls.thumbnail,
    height: controls.thumbnail,
    borderRadius: radius.sm,
    backgroundColor: color.surface.muted,
  },
  countBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: radius.sm,
    backgroundColor: color.accent.background,
    alignItems: 'center',
  },
  countBadgeText: { color: color.accent.label, fontWeight: '600' },
  captionField: { flex: 1 },
  // The caption grows with what she writes rather than scrolling inside
  // a one-line box.
  captionInput: { minHeight: controls.thumbnail, textAlignVertical: 'top' },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border.default },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: controls.minTapTarget + 8,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  rowPressed: { backgroundColor: color.surface.muted },
  rowLabel: { flex: 1, color: color.text.primary },
  rowValue: { marginRight: spacing.sm },
  footer: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
