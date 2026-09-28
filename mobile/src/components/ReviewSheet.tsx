/**
 * Leave a review after a rental.
 *
 * Only shown when a booking is `completed` and she has not already
 * reviewed it. The server checks both again — this just means she is
 * never offered a button that would be refused.
 */

import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { REVIEW_MAX_RATING, color, fontSize, spacing } from '@loane/shared';
import { Button } from './Button';
import { Header } from './Header';
import { Input } from './Input';
import { Icon } from './Icon';
import { Text } from './Text';
import { writeReview } from '../firebase/callables';
import { callableErrorMessage } from '../firebase/errors';
import { logEvent } from '../analytics/events';

interface Props {
  visible: boolean;
  bookingId: string;
  aboutUsername: string;
  onClose: () => void;
}

const HINTS = ['', 'Not good', 'Could be better', 'Fine', 'Good', 'Perfect'];

export function ReviewSheet({ visible, bookingId, aboutUsername, onClose }: Props) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (rating === 0) return;
    setSending(true);
    try {
      await writeReview({ bookingId, rating, body });
      logEvent('review_written', {
        surface: 'other',
        targetType: 'booking',
        targetId: bookingId,
        meta: { rating },
      });
      onClose();
      Alert.alert('Thanks', `Your review of @${aboutUsername} is up.`);
    } catch (err) {
      Alert.alert('Loane', callableErrorMessage(err, 'Could not save that review.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <Header title="Leave a review" onBack={onClose} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="h3">How was renting with @{aboutUsername}?</Text>

          <View style={styles.stars}>
            {Array.from({ length: REVIEW_MAX_RATING }, (_, i) => i + 1).map((value) => (
              <Pressable
                key={value}
                onPress={() => setRating(value)}
                accessibilityRole="button"
                accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`}
                accessibilityState={{ selected: rating >= value }}
                hitSlop={6}
              >
                <Icon
                  name={rating >= value ? 'star' : 'star-outline'}
                  size={fontSize['5xl']}
                  tint={rating >= value ? color.text.primary : color.text.disabled}
                />
              </Pressable>
            ))}
          </View>
          {rating > 0 ? (
            <Text variant="bodySmall" tone="secondary" style={styles.hint}>
              {HINTS[rating]}
            </Text>
          ) : null}

          <Input
            label="Anything to add? (optional)"
            value={body}
            onChangeText={setBody}
            placeholder="Was she easy to deal with? Was the piece as described?"
            multiline
            numberOfLines={4}
            style={styles.multiline}
          />

          <Text variant="caption" tone="muted">
            You can change this for 48 hours. After that it is fixed.
          </Text>

          <Button
            label="Post review"
            onPress={submit}
            loading={sending}
            disabled={rating === 0}
            style={styles.submit}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: color.surface.page },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  stars: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  hint: { marginTop: spacing.xs },
  multiline: { height: 110, textAlignVertical: 'top', marginTop: spacing.lg },
  submit: { marginTop: spacing.lg },
});
