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

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Keyboard,
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
import { Toggle } from '../../src/components/Toggle';
import { usePostDraft } from '../../src/post/postDraft';

export default function PostDetails() {
  const router = useRouter();
  const draft = usePostDraft();
  const cover = draft.photos[0];
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setKeyboardHeight(event.endCoordinates.height);
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      },
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
  const scheduleLabel = draft.scheduledAt ? formatSchedule(draft.scheduledAt) : null;

  const setScheduleOption = (option: ScheduleOption) => {
    draft.setScheduledAt(option === 'off' ? null : nextScheduleDate(option));
  };

  const openSchedule = () => {
    const options: { label: string; value: ScheduleOption }[] = [
      { label: 'Off', value: 'off' },
      { label: 'Later today', value: 'tonight' },
      { label: 'Tomorrow morning', value: 'tomorrowMorning' },
      { label: 'Tomorrow evening', value: 'tomorrowEvening' },
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Schedule post',
          options: [...options.map((o) => o.label), 'Cancel'],
          cancelButtonIndex: options.length,
        },
        (index) => {
          const picked = options[index];
          if (picked) setScheduleOption(picked.value);
        },
      );
      return;
    }

    Alert.alert(
      'Schedule post',
      undefined,
      [
        ...options.map((option) => ({
          text: option.label,
          onPress: () => setScheduleOption(option.value),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
      { cancelable: true },
    );
  };

  return (
    <Screen flush>
      <Header title="New post" onBack={() => router.back()} />
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            keyboardHeight > 0 && { paddingBottom: keyboardHeight + controls.buttonHeight },
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
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
            <Text variant="label" tone="muted" style={styles.sectionLabel}>
              Post details
            </Text>
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
            <Row label="Schedule post" value={scheduleLabel} onPress={openSchedule} />
          </View>

          <View style={styles.advanced}>
            <Text variant="label" tone="muted" style={styles.sectionLabel}>
              Advanced settings
            </Text>
            <Toggle
              label="Hide like count"
              help="Only you will see how many people liked this look."
              value={draft.settings.hideLikeCount}
              onValueChange={(value) => draft.setSetting('hideLikeCount', value)}
            />
            <Toggle
              label="Turn off commenting"
              help="People can still like, save and share this look."
              value={draft.settings.commentsDisabled}
              onValueChange={(value) => draft.setSetting('commentsDisabled', value)}
            />
            <Toggle
              label="Turn off sharing"
              help="People will not be able to send this look in chats."
              value={draft.settings.sharingDisabled}
              onValueChange={(value) => draft.setSetting('sharingDisabled', value)}
            />
            <Toggle
              label="Hide from profile grid"
              help="This look can still appear in feed, but not on your closet profile."
              value={draft.settings.hideFromProfile}
              onValueChange={(value) => draft.setSetting('hideFromProfile', value)}
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, keyboardHeight > 0 && { bottom: keyboardHeight }]}>
          <Button label="Preview" onPress={() => router.push('/new-post/preview')} />
        </View>
      </View>
    </Screen>
  );
}

type ScheduleOption = 'off' | 'tonight' | 'tomorrowMorning' | 'tomorrowEvening';

function nextScheduleDate(option: Exclude<ScheduleOption, 'off'>) {
  const now = new Date();
  const date = new Date(now);
  if (option === 'tonight') {
    date.setHours(20, 0, 0, 0);
    if (date <= now) date.setDate(date.getDate() + 1);
    return date;
  }
  date.setDate(date.getDate() + 1);
  date.setHours(option === 'tomorrowMorning' ? 9 : 20, 0, 0, 0);
  return date;
}

function formatSchedule(value: Date) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isToday = value.toDateString() === now.toDateString();
  const isTomorrow = value.toDateString() === tomorrow.toDateString();
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    value,
  );
  if (isToday) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
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
  content: { paddingBottom: controls.buttonHeight + spacing.xxl },
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
    backgroundColor: color.role.shared.background,
    alignItems: 'center',
  },
  countBadgeText: { color: color.role.shared.label, fontWeight: '600' },
  captionField: { flex: 1 },
  // The caption grows with what she writes rather than scrolling inside
  // a one-line box.
  captionInput: { minHeight: controls.thumbnail, textAlignVertical: 'top' },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border.default },
  sectionLabel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  advanced: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
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
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: color.surface.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
});
