/**
 * Report something, and optionally block the person while you are there.
 *
 * The two usually belong together: someone reporting harassment almost
 * always wants them gone from her feed too, and making her find a second
 * screen for that is unkind.
 */

import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import {
  REPORT_REASONS,
  color,
  spacing,
  type ReportReason,
  type ReportTargetType,
} from '@loane/shared';
import { Button } from './Button';
import { Chip } from './Chip';
import { Header } from './Header';
import { Input } from './Input';
import { Text } from './Text';
import { Toggle } from './Toggle';
import { blockUser, submitReport } from '../firebase/callables';
import { callableErrorMessage } from '../firebase/errors';
import { logEvent } from '../analytics/events';

const REASON_LABELS: Record<ReportReason, string> = {
  item_damaged: 'Item damaged',
  never_received: 'Never received the item',
  item_not_returned: 'Item not returned',
  item_stolen_or_lost: 'Item stolen or lost',
  not_as_described: 'Not as described',
  no_show: "She didn't turn up",
  harassment: 'Harassment',
  inappropriate_content: 'Inappropriate content',
  spam_or_scam: 'Spam or a scam',
  counterfeit: 'Counterfeit',
  off_platform_payment: 'Asked to pay outside Loane',
  other: 'Something else',
};

interface Props {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string;
  /** The person behind it, if there is one — enables the block option. */
  targetUid?: string;
  targetLabel: string;
  onClose: () => void;
}

export function ReportSheet({
  visible,
  targetType,
  targetId,
  targetUid,
  targetLabel,
  onClose,
}: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await submitReport({ targetType, targetId, targetUid, reason, details });
      logEvent('report_submitted', { surface: 'other', targetType: null, targetId });

      if (alsoBlock && targetUid) {
        await blockUser({ uid: targetUid });
        logEvent('user_blocked', { surface: 'other', targetType: 'user', targetId: targetUid });
      }

      onClose();
      Alert.alert(
        'Thanks for telling us',
        alsoBlock
          ? "We'll look at this. You won't see each other on Loane any more."
          : "We'll look at this. You won't hear back automatically, but every report is read.",
      );
    } catch (err) {
      Alert.alert('Loane', callableErrorMessage(err, 'Could not send that report.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <Header title="Report" onBack={onClose} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="bodySmall" tone="secondary">
            Reporting {targetLabel}. Only Loane sees this — they are never told who reported
            them.
          </Text>

          <Text variant="label" style={styles.section}>
            What happened
          </Text>
          <View style={styles.row}>
            {REPORT_REASONS.map((value) => (
              <Chip
                key={value}
                label={REASON_LABELS[value]}
                active={reason === value}
                onPress={() => setReason(value)}
              />
            ))}
          </View>

          <Input
            label="Anything else (optional)"
            value={details}
            onChangeText={setDetails}
            placeholder="Tell us what happened."
            multiline
            numberOfLines={3}
            style={styles.multiline}
          />

          {targetUid ? (
            <Toggle
              label="Also block her"
              help="You won't see each other, message, or rent from each other."
              value={alsoBlock}
              onValueChange={setAlsoBlock}
            />
          ) : null}

          <Button
            label="Send report"
            variant="dark"
            onPress={submit}
            loading={sending}
            disabled={!reason}
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
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  multiline: { height: 88, textAlignVertical: 'top', marginTop: spacing.lg },
  submit: { marginTop: spacing.lg },
});
