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
  activeMention,
  fonts,
  insertMention,
  LIMITS,
  mentionParts,
  color,
  controls,
  radius,
  spacing,
  timeAgo,
  type,
  type Comment,
  type UserSummary,
  profileHref,
} from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { ReportSheet } from '../src/components/ReportSheet';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { SkeletonRows } from '../src/components/Skeleton';
import { useAuth } from '../src/auth/AuthProvider';
import { useComments } from '../src/hooks/useComments';
import { useHiddenUids } from '../src/hooks/useBlocks';
import { useStudentSearch } from '../src/hooks/useFollowing';
import { usePullToRefresh } from '../src/hooks/usePullToRefresh';

export default function Comments() {
  const router = useRouter();
  const { postId, postAuthorUid } = useLocalSearchParams<{
    postId: string;
    postAuthorUid?: string;
  }>();
  const { profile } = useAuth();
  const {
    threaded,
    loading,
    busy,
    add,
    remove,
    canDelete,
    isLiked,
    likeCountOf,
    toggleLike,
    error,
    retry,
    hasMore,
    loadMore,
    loadingMore,
  } = useComments(postId);
  const hidden = useHiddenUids();
  // Live list: the pull is reassurance, see usePullToRefresh.
  const { refreshControl } = usePullToRefresh();
  const [draft, setDraft] = useState('');
  const [reporting, setReporting] = useState<Comment | null>(null);
  /** Who she is answering, if anyone. */
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  // The on-device half of blocking: someone she blocked simply is not
  // in the thread. See docs/security.md.
  const visible = threaded.filter((row) => !hidden.has(row.comment.authorUid));

  /*
    @mention suggestions. Where her cursor is, and a cursor we set
    ourselves after picking a name (undefined the rest of the time, so
    the box stays uncontrolled and typing never fights it).
  */
  const [cursor, setCursor] = useState(0);
  const [forcedSelection, setForcedSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);
  const mention = activeMention(draft, cursor);
  // The campus search wants two letters; before that, the thread's own
  // people are the likeliest answer anyway.
  const { results: searched } = useStudentSearch(
    mention && mention.query.length >= 2 ? mention.query : '',
  );
  const suggestions = useMemo<UserSummary[]>(() => {
    if (!mention) return [];
    const q = mention.query;
    const seen = new Set<string>();
    const out: UserSummary[] = [];
    const push = (u: UserSummary) => {
      if (seen.has(u.uid) || u.uid === profile?.uid || hidden.has(u.uid)) return;
      if (!u.username.startsWith(q)) return;
      seen.add(u.uid);
      out.push(u);
    };
    // People already talking here first, newest last-seen first.
    for (const row of [...visible].reverse()) push(row.comment.author);
    for (const u of searched) push(u);
    return out.slice(0, 5);
  }, [mention, visible, searched, profile?.uid, hidden]);

  const pickMention = (username: string) => {
    const next = insertMention(draft, cursor, username);
    setDraft(next.text);
    setCursor(next.cursor);
    setForcedSelection({ start: next.cursor, end: next.cursor });
  };

  /**
   * The comment a reply is filed under. Threads are one level deep and
   * the server refuses a reply to a reply, so answering a reply files it
   * under that reply's parent — Instagram does the same, and the @name
   * startReply puts in the box keeps it clear who she is answering. A
   * reply whose parent is gone (shown at the top level) is answered as
   * a plain comment for the same reason.
   */
  const topLevelIds = useMemo(
    () => new Set(visible.filter((r) => !r.comment.parentCommentId).map((r) => r.comment.id)),
    [visible],
  );
  const threadParentId = (comment: Comment): string | undefined => {
    if (!comment.parentCommentId) return comment.id;
    return topLevelIds.has(comment.parentCommentId) ? comment.parentCommentId : undefined;
  };

  const startReply = (comment: Comment) => {
    setReplyTo(comment);
    // Answering a reply: start with her @name, as on Instagram, unless
    // it is her own or already there.
    if (comment.parentCommentId && comment.authorUid !== profile?.uid) {
      const tag = `@${comment.author.username} `;
      if (!draft.includes(tag.trim())) {
        const next = `${tag}${draft}`;
        setDraft(next);
        setCursor(next.length);
        setForcedSelection({ start: next.length, end: next.length });
      }
    }
  };

  const onToggleLike = (comment: Comment) => {
    void toggleLike(comment).catch((err: unknown) =>
      Alert.alert('Loane', err instanceof Error ? err.message : 'Could not do that just now.'),
    );
  };

  const onSend = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const parent = replyTo;
    setDraft('');
    setReplyTo(null);
    try {
      await add(text, parent ? threadParentId(parent) : undefined);
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
          <SkeletonRows avatar={32} />
        ) : error && visible.length === 0 ? (
          <EmptyState
            title="Couldn't load comments"
            body="Check your connection and try again."
            actionLabel="Try again"
            onAction={retry}
          />
        ) : visible.length === 0 ? (
          <EmptyState title="No comments yet" body="Say something nice about this look." />
        ) : (
          <FlatList
            refreshControl={refreshControl}
            data={visible}
            keyExtractor={(row) => row.comment.id}
            contentContainerStyle={styles.list}
            keyboardDismissMode="on-drag"
            // A page at a time: nearing the bottom brings in the next.
            onEndReached={hasMore ? loadMore : undefined}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.more} accessibilityLabel="Loading more comments">
                  <ActivityIndicator color={color.icon.default} />
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <Row
                comment={item.comment}
                depth={item.depth}
                canDelete={canDelete(item.comment, postAuthorUid)}
                isMine={item.comment.authorUid === profile?.uid}
                liked={isLiked(item.comment.id)}
                likeCount={likeCountOf(item.comment)}
                onToggleLike={() => onToggleLike(item.comment)}
                onOpenAuthor={() => router.push(profileHref(item.comment.author))}
                onOpenHandle={(handle) => router.push(`/u/${handle}`)}
                onDelete={() => onDelete(item.comment)}
                onReport={() => setReporting(item.comment)}
                // Replying to a reply lands on its parent, so the thread
                // never goes deeper than one level.
                onReply={() => startReply(item.comment)}
              />
            )}
          />
        )}

        {suggestions.length > 0 ? (
          <View style={styles.suggestions} accessibilityLabel="People to mention">
            {suggestions.map((u) => (
              <Pressable
                key={u.uid}
                onPress={() => pickMention(u.username)}
                accessibilityRole="button"
                accessibilityLabel={`Mention @${u.username}`}
                style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
              >
                <Avatar url={u.photoUrl} name={u.displayName} size={28} />
                <View style={styles.rowText}>
                  <Text variant="bodySmall" style={styles.strong} numberOfLines={1}>
                    @{u.username}
                  </Text>
                  <Text variant="caption" tone="muted" uppercase={false} numberOfLines={1}>
                    {u.displayName}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

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
            maxFontSizeMultiplier={controls.maxFontScale}
            value={draft}
            onChangeText={setDraft}
            selection={forcedSelection}
            onSelectionChange={(e) => {
              setCursor(e.nativeEvent.selection.start);
              // Hand the cursor back to her once ours has landed.
              if (forcedSelection) setForcedSelection(undefined);
            }}
            placeholder={replyTo ? `Reply to @${replyTo.author.username}` : 'Add a comment'}
            accessibilityLabel={replyTo ? `Reply to @${replyTo.author.username}` : 'Add a comment'}
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
  liked,
  likeCount,
  onToggleLike,
  onOpenAuthor,
  onOpenHandle,
  onDelete,
  onReport,
  onReply,
}: {
  comment: Comment;
  depth: 0 | 1;
  canDelete: boolean;
  isMine: boolean;
  liked: boolean;
  likeCount: number;
  onToggleLike: () => void;
  onOpenAuthor: () => void;
  onOpenHandle: (handle: string) => void;
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
          {/* @handles are tappable, the way they are on Instagram. */}
          {mentionParts(comment.body).map((part, i) =>
            part.handle ? (
              <Text
                key={i}
                style={styles.mention}
                accessibilityRole="link"
                onPress={() => onOpenHandle(part.handle as string)}
              >
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
        </Text>
        <View style={styles.meta}>
          <Text variant="caption" tone="muted">
            {timeAgo(comment.createdAt)}
          </Text>
          {likeCount > 0 ? (
            <Text variant="caption" tone="muted">
              {likeCount === 1 ? '1 like' : `${likeCount} likes`}
            </Text>
          ) : null}
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

      <Pressable
        onPress={onToggleLike}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={liked ? 'Unlike this comment' : 'Like this comment'}
        accessibilityState={{ selected: liked }}
        style={styles.rowAction}
      >
        <Icon
          name={liked ? 'heart' : 'heart-outline'}
          size={16}
          tint={liked ? color.status.error : color.icon.muted}
        />
      </Pressable>

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
  list: { padding: spacing.md, gap: spacing.md },
  more: { minHeight: controls.minTapTarget, alignItems: 'center', justifyContent: 'center' },
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
  mention: { fontWeight: '600', color: color.text.heading },
  suggestions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    paddingVertical: spacing.xs,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: controls.minTapTarget,
    paddingHorizontal: spacing.md,
  },
  suggestionPressed: { backgroundColor: color.surface.muted },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
  input: {
    fontFamily: fonts.body,
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
