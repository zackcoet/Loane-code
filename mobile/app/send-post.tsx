/**
 * Sending a look to someone.
 *
 * The people offered first are the ones she follows and the ones who
 * follow her, because that is almost always who she means. Anyone else
 * on her campus she finds by typing a name.
 *
 * The send itself goes through a Cloud Function: it may have to start
 * several threads at once, it moves the look's share count, and the
 * preview stamped into the chat bubble has to be the real post rather
 * than whatever the phone claims it is.
 */

import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  LIMITS,
  color,
  controls,
  radius,
  spacing,
  type,
  type UserSummary,
} from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useSuggestedRecipients, useStudentSearch } from '../src/hooks/useFollowing';
import { useHiddenUids } from '../src/hooks/useBlocks';
import { sharePost } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { logEvent } from '../src/analytics/events';

export default function SendPost() {
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { people, loading } = useSuggestedRecipients();
  const [term, setTerm] = useState('');
  const { results, searching } = useStudentSearch(term);
  const hidden = useHiddenUids();

  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase().replace(/^@/, '');
    // While she is typing, narrow her own people first and fold in
    // anyone the campus-wide search turned up that is not already there.
    const base = q
      ? people.filter(
          (p) =>
            p.username.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q),
        )
      : people;
    const seen = new Set(base.map((p) => p.uid));
    const extra = q ? results.filter((r) => !seen.has(r.uid)) : [];
    return [...base, ...extra].filter((p) => !hidden.has(p.uid));
  }, [people, results, term, hidden]);

  const toggle = (uid: string) =>
    setPicked((current) =>
      current.includes(uid)
        ? current.filter((u) => u !== uid)
        : current.length >= LIMITS.sharePostRecipients.max
          ? current
          : [...current, uid],
    );

  const onSend = async () => {
    if (!postId || picked.length === 0 || sending) return;
    setSending(true);
    try {
      const result = await sharePost({ postId, toUids: picked, note: note.trim() || undefined });
      logEvent('post_shared', {
        surface: 'feed',
        targetType: 'post',
        targetId: postId,
        meta: { recipients: result.data.sentTo },
      });
      router.back();
      // Sent to one person: drop her straight into that chat, which is
      // where she is going to look for a reply anyway.
      if (result.data.conversationId) {
        router.push({ pathname: '/chat/[id]', params: { id: result.data.conversationId } });
      }
    } catch (err) {
      Alert.alert('Loane', callableErrorMessage(err, 'Could not send that.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen flush>
      <Header title="Send to" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.searchRow}>
          <Icon name="search" size={18} tint={color.icon.muted} />
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="Search by name or @username"
            placeholderTextColor={color.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
          />
          {term ? (
            <Pressable onPress={() => setTerm('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon name="close-circle" size={18} tint={color.icon.muted} />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={color.icon.default} />
          </View>
        ) : rows.length === 0 ? (
          <EmptyState
            title={term ? 'Nobody by that name' : 'Nobody to send to yet'}
            body={
              term
                ? searching
                  ? 'Still looking…'
                  : 'Try her exact @username.'
                : 'Follow a few closets and they show up here.'
            }
          />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(p) => p.uid}
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <PersonRow
                person={item}
                selected={picked.includes(item.uid)}
                onToggle={() => toggle(item.uid)}
              />
            )}
          />
        )}

        <View style={styles.footer}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a message (optional)"
            placeholderTextColor={color.text.muted}
            maxLength={LIMITS.messageBody.max}
            style={styles.note}
          />
          <Button
            label={
              picked.length === 0
                ? 'Send'
                : picked.length === 1
                  ? 'Send to 1 person'
                  : `Send to ${picked.length} people`
            }
            onPress={() => void onSend()}
            disabled={picked.length === 0 || sending}
            loading={sending}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function PersonRow({
  person,
  selected,
  onToggle,
}: {
  person: UserSummary;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${person.displayName}, @${person.username}`}
      style={({ pressed }) => [styles.person, pressed && styles.pressed]}
    >
      <Avatar url={person.photoUrl} name={person.displayName} size={44} />
      <View style={styles.personText}>
        <Text variant="bodySmall" style={styles.strong} numberOfLines={1}>
          {person.displayName}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          @{person.username}
        </Text>
      </View>
      <View style={[styles.check, selected && styles.checkOn]}>
        {selected ? <Icon name="checkmark" size={16} tint={color.icon.inverse} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: controls.minTapTarget,
    borderRadius: radius.pill,
    backgroundColor: color.surface.muted,
  },
  search: { flex: 1, fontSize: type.bodySmall.size, color: color.text.primary },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  pressed: { opacity: 0.6 },
  personText: { flex: 1 },
  strong: { fontWeight: '600' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: color.surface.inverse, borderColor: color.border.inverse },
  footer: {
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
  note: {
    minHeight: controls.minTapTarget,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.lg,
    fontSize: type.bodySmall.size,
    color: color.text.primary,
  },
});
