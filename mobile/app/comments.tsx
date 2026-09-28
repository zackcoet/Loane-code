/**
 * Comments on a look.
 *
 * A sheet rather than a screen of its own, because reading comments is
 * something you do to a post you are already looking at, not somewhere
 * you navigate to and come back from.
 *
 * She can delete her own comment, and the author of the look can delete
 * anything on it — clearing something nasty off her own post should not
 * mean waiting on us. Anything else, she reports.
 */

import { useState } from 'react';
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
  timeAgo,
  type,
  type Comment,
} from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { ReportSheet } from '../src/components/ReportSheet';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useComments } from '../src/hooks/useComments';
import { useHiddenUids } from '../src/hooks/useBlocks';

export default function Comments() {
  const router = useRouter();
  const { postId, postAuthorUid } = useLocalSearchParams<{
    postId: string;
    postAuthorUid?: string;
  }>();
  const { profile } = useAuth();
  const { threaded, loading, busy, add, remove, canDelete } = useComments(postId);
  const hidden = useHiddenUids();
  const [draft, setDraft] = useState('');
  const [reporting, setReporting] = useState<Comment | null>(null);
  /** Who she is answering, if anyone. */
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  // The on-device half of blocking: someone she blocked simply is not
  // in the thread. See docs/security.md.
  const visible = threaded.filter((row) => !hidden.has(row.comment.authorUid));

  const onSend = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const parent = replyTo;
    setDraft('');
    setReplyTo(null);
    try {
      await add(text, parent?.id);
    } catch (err) {
      // Put it back rather than losing what she typed.
      setDraft(text);
      setReplyTo(parent);
      Alert.alert('Loane', err instanceof Error ? err.message : 'Could not post that.');
    }
  };

  const onDelete = (comment: Comment) => {
    Alert.alert('Delete this comment?', 'It will be removed from the look.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void remove(comment.id).catch((err: unknown) =>
            Alert.alert('Loane', err instanceof Error ? err.message : 'Could not delete that.'),
          );
        },
      },
    ]);
  };

  return (
    <Screen flush>
      <Header title="Comments" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={color.icon.default} />
          </View>
        ) : visible.length === 0 ? (
          <EmptyState title="No comments yet" body="Say something nice about this look." />
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(row) => row.comment.id}
            contentContainerStyle={styles.list}
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => (
              <Row
                comment={item.comment}
                depth={item.depth}
                canDelete={canDelete(item.comment, postAuthorUid)}
                isMine={item.comment.authorUid === profile?.uid}
                onOpenAuthor={() => router.push(`/u/${item.comment.author.username}`)}
                onDelete={() => onDelete(item.comment)}
                onReport={() => setReporting(item.comment)}
                // Replying to a reply lands on its parent, so the thread
                // never goes deeper than one level.
                onReply={() => setReplyTo(item.comment)}
              />
            )}
          />
        )}

        {replyTo ? (
          <View style={styles.replyBar}>
            <Text variant="caption" tone="muted" uppercase={false} style={styles.replyBarText}>
              Replying to @{replyTo.author.username}
            </Text>
            <Pressable
              onPress={() => setReplyTo(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Stop replying"
            >
              <Icon name="close" size={16} tint={color.icon.muted} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composer}>
          <Avatar url={profile?.photoUrl} name={profile?.displayName} size={32} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={replyTo ? `Reply to @${replyTo.author.username}` : 'Add a comment'}
            placeholderTextColor={color.text.muted}
            maxLength={LIMITS.commentBody.max}
            multiline
            style={styles.input}
          />
          <Pressable
            onPress={() => void onSend()}
            disabled={!draft.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
            style={[styles.send, (!draft.trim() || busy) && styles.sendDisabled]}
          >
            <Text variant="caption" tone={draft.trim() && !busy ? 'inverse' : 'disabled'}>
              Post
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ReportSheet
        visible={reporting !== null}
        targetType="comment"
        targetId={reporting?.id ?? ''}
        targetUid={reporting?.authorUid}
        targetLabel={reporting ? `@${reporting.author.username}'s comment` : ''}
        onClose={() => setReporting(null)}
      />
    </Screen>
  );
}

function Row({
  comment,
  depth,
  canDelete,
  isMine,
  onOpenAuthor,
  onDelete,
  onReport,
  onReply,
}: {
  comment: Comment;
  depth: 0 | 1;
  canDelete: boolean;
  isMine: boolean;
  onOpenAuthor: () => void;
  onDelete: () => void;
  onReport: () => void;
  onReply: () => void;
}) {
  return (
    <View style={[styles.row, depth === 1 && styles.reply]}>
      <Pressable
        onPress={onOpenAuthor}
        accessibilityRole="button"
        accessibilityLabel={`Open @${comment.author.username}'s closet`}
      >
        <Avatar
          url={comment.author.photoUrl}
          name={comment.author.displayName}
          size={depth === 1 ? 26 : 32}
        />
      </Pressable>

      <View style={styles.rowText}>
        <Text variant="bodySmall">
          <Text style={styles.strong} accessibilityRole="button" onPress={onOpenAuthor}>
            @{comment.author.username}{' '}
          </Text>
          {comment.body}
        </Text>
        <View style={styles.meta}>
          <Text variant="caption" tone="muted">
            {timeAgo(comment.createdAt)}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            accessibilityRole="button"
            onPress={onReply}
            style={styles.replyLink}
          >
            Reply
          </Text>
        </View>
      </View>

      {canDelete ? (
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Delete this comment"
          style={styles.rowAction}
        >
          <Icon name="trash-outline" size={16} tint={color.icon.muted} />
        </Pressable>
      ) : null}

      {/* Her own comment is hers to delete, not to report. */}
      {!isMine ? (
        <Pressable
          onPress={onReport}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Report this comment"
          style={styles.rowAction}
        >
          <Icon name="flag-outline" size={16} tint={color.icon.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowText: { flex: 1 },
  rowAction: { paddingHorizontal: spacing.xs, paddingTop: 2 },
  // One level of indentation, and only one. See useComments.
  reply: { paddingLeft: spacing.xl },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  replyLink: { fontWeight: '600' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: color.surface.muted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
  replyBarText: { flex: 1 },
  strong: { fontWeight: '600' },
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
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.lg,
    fontSize: type.bodySmall.size,
    color: color.text.primary,
  },
  send: {
    height: controls.minTapTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.inverse,
  },
  sendDisabled: { backgroundColor: color.surface.disabled },
});
