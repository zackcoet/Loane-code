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
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { pickPhoto, uploadMessagePhoto } from '../../src/lib/photo';

export default function Chat() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { conversation, messages, loading, send, markRead } = useConversation(id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);

  // Opening the thread is what clears the badge.
  useEffect(() => {
    void markRead();
  }, [markRead]);

  const otherUid = conversation?.participantUids.find((uid) => uid !== profile?.uid);
  const them = otherUid ? conversation?.participants?.[otherUid] : undefined;

  /** Send a photo — showing a stain, or how something fits. */
  const onAttach = async () => {
    if (!profile || attaching) return;
    const source = await new Promise<'camera' | 'library' | null>((resolve) => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Take a photo', 'Choose from library'], cancelButtonIndex: 0 },
          (i) => resolve(i === 1 ? 'camera' : i === 2 ? 'library' : null),
        );
      } else {
        Alert.alert('Send a photo', undefined, [
          { text: 'Take a photo', onPress: () => resolve('camera') },
          { text: 'Choose from library', onPress: () => resolve('library') },
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ]);
      }
    });
    if (!source) return;

    setAttaching(true);
    try {
      const picked = await pickPhoto(source, 'free');
      if (!picked) return;
      const uploaded = await uploadMessagePhoto(profile.uid, picked);
      await send(draft, uploaded);
      setDraft('');
    } catch {
      Alert.alert('Loane', 'Could not send that photo. Try again.');
    } finally {
      setAttaching(false);
    }
  };

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
          <Pressable
            onPress={onAttach}
            disabled={attaching}
            accessibilityRole="button"
            accessibilityLabel="Send a photo"
            style={styles.attach}
          >
            <Text variant="h3" tone={attaching ? 'disabled' : 'primary'}>
              {attaching ? '…' : '+'}
            </Text>
          </Pressable>
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
        {message.photo ? (
          <Image
            source={{ uri: message.photo.url }}
            style={styles.bubblePhoto}
            resizeMode="cover"
          />
        ) : null}
        {message.body ? (
          <Text
            variant="bodySmall"
            tone={mine ? 'inverse' : 'primary'}
            style={message.photo ? styles.captionUnderPhoto : undefined}
          >
            {message.body}
          </Text>
        ) : null}
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
  attach: {
    width: controls.minTapTarget,
    height: controls.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubblePhoto: {
    width: 200,
    height: 240,
    borderRadius: radius.sm,
    backgroundColor: color.surface.muted,
  },
  captionUnderPhoto: { marginTop: spacing.sm },
});
