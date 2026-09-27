/**
 * One conversation.
 *
 * Inverted list, newest at the bottom — the ordinary shape of a chat.
 * Messages arrive over a realtime listener, so both sides see them as
 * they are sent.
 */

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LIMITS, color, controls, radius, spacing, type, type Message } from '@loane/shared';
import { EmptyState } from '../../src/components/EmptyState';
import { Header } from '../../src/components/Header';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthProvider';
import { useConversation } from '../../src/hooks/useMessaging';

export default function Chat() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { conversation, messages, loading, send, markRead } = useConversation(id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Opening the thread is what clears the badge.
  useEffect(() => {
    void markRead();
  }, [markRead]);

  const otherUid = conversation?.participantUids.find((uid) => uid !== profile?.uid);
  const them = otherUid ? conversation?.participants?.[otherUid] : undefined;

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      await send(text);
    } catch {
      // Put it back so she does not lose what she typed.
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen flush>
      <Header
        title={them ? `@${them.username}` : 'Chat'}
        onBack={() => router.back()}
        right={
          them ? (
            <Text
              variant="caption"
              tone="muted"
              accessibilityRole="button"
              onPress={() => router.push(`/u/${them.username}`)}
            >
              Profile
            </Text>
          ) : null
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={color.icon.default} />
          </View>
        ) : messages.length === 0 ? (
          <EmptyState
            title="Say hello"
            body="Ask about fit, condition, or where to meet."
          />
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            inverted
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <Bubble message={item} mine={item.senderUid === profile?.uid} />}
          />
        )}

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            placeholderTextColor={color.text.muted}
            maxLength={LIMITS.messageBody.max}
            multiline
            style={styles.input}
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]}
          >
            <Text variant="caption" tone={draft.trim() ? 'inverse' : 'disabled'}>
              Send
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text variant="bodySmall" tone={mine ? 'inverse' : 'primary'}>
          {message.body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  mine: { backgroundColor: color.surface.inverse, borderBottomRightRadius: radius.sm },
  theirs: {
    backgroundColor: color.surface.muted,
    borderWidth: 1,
    borderColor: color.border.default,
    borderBottomLeftRadius: radius.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
  input: {
    flex: 1,
    minHeight: controls.minTapTarget,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.lg,
    fontSize: type.bodySmall.size,
    color: color.text.primary,
  },
  sendButton: {
    height: controls.minTapTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.inverse,
  },
  sendDisabled: { backgroundColor: color.surface.disabled },
});
