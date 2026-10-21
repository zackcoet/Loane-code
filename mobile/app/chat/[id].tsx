/**
 * One conversation.
 *
 * Inverted list, newest at the bottom — the ordinary shape of a chat.
 * Messages arrive over a realtime listener, so both sides see them as
 * they are sent.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  fonts,
  LIMITS,
  color,
  controls,
  iconSize,
  isRequestFor,
  radius,
  receiptFor,
  replyFor,
  replyPreview,
  spacing,
  type,
  type Message,
  type MessageReply,
} from '@loane/shared';
import { Avatar } from '../../src/components/Avatar';
import { EmptyState } from '../../src/components/EmptyState';
import { Header } from '../../src/components/Header';
import { Icon } from '../../src/components/Icon';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthProvider';
import {
  deleteThreadForMe,
  MESSAGE_QUOTA_FULL,
  useConversation,
} from '../../src/hooks/useMessaging';
import { useFollowingUids } from '../../src/hooks/useFollowing';
import { useReportOrBlock } from '../../src/hooks/useReportOrBlock';
import { IconButton } from '../../src/components/IconButton';
import { ReportSheet } from '../../src/components/ReportSheet';
import { pickPhoto, uploadMessagePhoto } from '../../src/lib/photo';
import { SharedListingCard } from '../../src/components/SharedListingCard';
import { SwipeToReply } from '../../src/components/SwipeToReply';

export default function Chat() {
  const [reporting, setReporting] = useState(false);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { conversation, messages, loading, send, markRead, setLiked } = useConversation(id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  // The message she swiped on, shown above the composer until she sends
  // or taps the ×.
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);

  // Having the thread open is what clears the badge and tells the
  // other person "Seen" — but only while she can actually see it. A
  // chat left open behind another screen, or with the phone locked,
  // would otherwise mark messages seen that nobody has read.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (focused && appActive) void markRead();
  }, [markRead, focused, appActive]);

  // A chat from someone she does not follow, that she has not answered:
  // say so above the composer, and offer a way out besides replying.
  const { uids: following, loading: followingLoading } = useFollowingUids();
  const isRequest =
    !!conversation &&
    !!profile &&
    !followingLoading &&
    isRequestFor(conversation, profile.uid, following);

  const onDeleteRequest = () => {
    if (!conversation || !profile) return;
    Alert.alert('Delete this request?', 'The chat disappears from your messages only.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void deleteThreadForMe(conversation.id, profile.uid)
            .then(() => router.back())
            .catch(() => Alert.alert('Loane', 'Could not delete that chat. Try again.')),
      },
    ]);
  };

  // "Seen" or "Sent" under her newest message, when the newest is hers.
  const receipt = receiptFor(conversation, messages, profile?.uid);

  const otherUid = conversation?.participantUids.find((uid) => uid !== profile?.uid);
  const them = otherUid ? conversation?.participants?.[otherUid] : undefined;
  const reportOrBlock = useReportOrBlock({
    uid: them?.uid ?? '',
    username: them?.username ?? '',
    onReport: () => setReporting(true),
    onBlocked: () => router.back(),
  });

  /** Who a quote is from, in the words the thread uses. */
  const nameFor = useCallback(
    (senderUid: string) =>
      senderUid === profile?.uid ? 'You' : them ? `@${them.username}` : 'Them',
    [profile?.uid, them],
  );

  const startReply = useCallback((message: Message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  }, []);

  /** Tapping a quote scrolls up to the original, if it is loaded. */
  const jumpTo = useCallback(
    (messageId: string) => {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index < 0) return;
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    },
    [messages],
  );

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
      await send(draft, uploaded, replyingTo ? replyFor(replyingTo) : null);
      setDraft('');
      setReplyingTo(null);
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
    const reply = replyingTo;
    setReplyingTo(null);
    try {
      await send(text, undefined, reply ? replyFor(reply) : null);
    } catch (err) {
      if (err instanceof Error && err.message === MESSAGE_QUOTA_FULL) {
        Alert.alert(
          'Loane',
          'You are sending a lot of messages. Take a short break, then try again.',
        );
      }
      // Put the reply back too, so the retry still answers the same thing.
      setReplyingTo(reply);
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
          // Her face, not the word "Profile". It fits the header's
          // icon-sized slot instead of being squashed into it, and
          // tapping the person at the top of a chat to open them is
          // what every other messaging app does.
          them ? (
            // Her face AND the "…": report or block has to be reachable
            // from the screen where somebody is actually messaging her,
            // not only from a profile.
            <View style={styles.headerRight}>
              <Pressable
                onPress={() => router.push(`/u/${them.username}`)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Open @${them.username}'s closet`}
                style={styles.headerAvatar}
              >
                <Avatar url={them.photoUrl} name={them.displayName} size={32} />
              </Pressable>
              <IconButton
                name="ellipsis-horizontal"
                accessibilityLabel="Report or block"
                onPress={reportOrBlock.open}
              />
            </View>
          ) : null
        }
      />

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="user"
        targetId={them?.uid ?? ''}
        targetLabel={them ? `@${them.username}` : 'this student'}
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
          <EmptyState title="Say hello" body="Ask about fit, condition, or where to meet." />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            inverted
            contentContainerStyle={styles.list}
            // Rows are different heights, so a jump to a far-off quote
            // can miss on the first try. Scroll near it, then try again.
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              listRef.current?.scrollToOffset({ offset: index * averageItemLength });
              setTimeout(
                () => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }),
                250,
              );
            }}
            renderItem={({ item }) => (
              <>
                <Bubble
                  message={item}
                  mine={item.senderUid === profile?.uid}
                  likedByMe={!!profile?.uid && (item.likedBy ?? []).includes(profile.uid)}
                  onSetLiked={(on) => void setLiked(item.id, on)}
                  router={router}
                  onReply={() => startReply(item)}
                  onJumpTo={jumpTo}
                  quoteName={item.replyTo ? nameFor(item.replyTo.senderUid) : ''}
                  quoteGone={
                    item.replyTo
                      ? messages.find((m) => m.id === item.replyTo!.messageId)?.isDeleted === true
                      : false
                  }
                />
                {receipt?.messageId === item.id ? (
                  <Text
                    variant="caption"
                    tone="muted"
                    uppercase={false}
                    style={styles.receipt}
                    accessibilityLiveRegion="polite"
                  >
                    {receipt.label}
                  </Text>
                ) : null}
              </>
            )}
          />
        )}

        {isRequest && them ? (
          <View style={styles.requestBar}>
            <Text variant="bodySmall" tone="secondary" style={styles.requestText}>
              You don&apos;t follow @{them.username}. Reply to move this chat to your messages.
            </Text>
            <Pressable
              onPress={onDeleteRequest}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Delete this request"
              style={styles.requestDelete}
            >
              <Text variant="caption" tone="error">
                Delete
              </Text>
            </Pressable>
          </View>
        ) : null}

        {replyingTo ? (
          <View style={styles.replyBar}>
            <View style={styles.replyBarText}>
              <Text variant="caption" tone="muted">
                Replying to{' '}
                {nameFor(replyingTo.senderUid) === 'You'
                  ? 'yourself'
                  : nameFor(replyingTo.senderUid)}
              </Text>
              <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
                {replyPreview(replyFor(replyingTo))}
              </Text>
            </View>
            <IconButton
              name="close"
              size={iconSize.sm}
              tint={color.icon.muted}
              accessibilityLabel="Cancel reply"
              onPress={() => setReplyingTo(null)}
            />
          </View>
        ) : null}

        <View style={styles.composer}>
          <Pressable
            onPress={onAttach}
            disabled={attaching}
            accessibilityRole="button"
            accessibilityLabel="Send a photo"
            style={styles.attach}
          >
            {attaching ? (
              <ActivityIndicator color={color.icon.muted} />
            ) : (
              <Icon name="add" size={iconSize.md} />
            )}
          </Pressable>
          <TextInput
            ref={inputRef}
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

/**
 * Two taps closer together than this are a double-tap.
 *
 * A timer on the bubble's own Pressable rather than a gesture-handler
 * Tap: the bubble already takes long-press through that Pressable, and
 * TaggablePhoto's history is what happens when two touch systems argue
 * over one finger. The swipe-to-reply pan only claims sideways drags,
 * so it never sees a tap.
 */
const DOUBLE_TAP_MS = 300;

function Bubble({
  message,
  mine,
  likedByMe,
  onSetLiked,
  router,
  onReply,
  onJumpTo,
  quoteName,
  quoteGone,
}: {
  message: Message;
  mine: boolean;
  /** She has hearted this one herself. */
  likedByMe: boolean;
  onSetLiked: (on: boolean) => void;
  router: ReturnType<typeof useRouter>;
  onReply: () => void;
  onJumpTo: (messageId: string) => void;
  /** "You" or "@maddie" — who said the quoted message. */
  quoteName: string;
  /** The original was taken down by moderation since she replied. */
  quoteGone: boolean;
}) {
  const hearts = (message.likedBy ?? []).length;
  const likeLabel = likedByMe ? 'Unlike' : 'Like';

  // Double-tap hearts it, like Instagram. It never un-hearts — tapping
  // twice more by accident and silently taking it back is worse than
  // the accidental heart. Taking it back is a tap on the heart itself,
  // or the long-press menu.
  const lastTap = useRef(0);
  const onPress = () => {
    const nowMs = Date.now();
    if (nowMs - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (!likedByMe && !message.isDeleted) onSetLiked(true);
    } else {
      lastTap.current = nowMs;
    }
  };

  // Long-press offers Reply and Like too, for anyone who never
  // discovers the swipe or the double-tap.
  const onLongPress = () => {
    const toggleLike = () => onSetLiked(!likedByMe);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Reply', likeLabel], cancelButtonIndex: 0 },
        (i) => (i === 1 ? onReply() : i === 2 ? toggleLike() : undefined),
      );
    } else {
      Alert.alert('Message', undefined, [
        { text: 'Reply', onPress: onReply },
        { text: likeLabel, onPress: toggleLike },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <SwipeToReply onReply={onReply}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        // One VoiceOver element with a Reply action — except a shared
        // look or piece, whose card must stay its own button to be openable.
        accessible={!message.sharedPost && !message.sharedListing}
        accessibilityLabel={message.body || (message.photo ? 'Photo' : 'Message')}
        accessibilityValue={
          hearts > 0 ? { text: hearts === 1 ? '1 heart' : '2 hearts' } : undefined
        }
        accessibilityActions={[
          { name: 'reply', label: 'Reply' },
          { name: 'like', label: likeLabel },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'reply') onReply();
          if (e.nativeEvent.actionName === 'like') onSetLiked(!likedByMe);
        }}
        style={[
          styles.bubbleRow,
          mine ? styles.rowMine : styles.rowTheirs,
          hearts > 0 && styles.rowHearted,
        ]}
      >
        <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
          {message.replyTo ? (
            <Quote
              reply={message.replyTo}
              name={quoteName}
              gone={quoteGone}
              onPress={() => onJumpTo(message.replyTo!.messageId)}
            />
          ) : null}
          {/* A look somebody sent. The snapshot is what renders; tapping
            opens the live post, which is where the truth is. */}
          {message.sharedPost ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/post/[id]',
                  params: { id: message.sharedPost!.postId },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Open @${message.sharedPost.authorUsername}'s look`}
              style={styles.sharedPost}
            >
              {message.sharedPost.photoUrl ? (
                <Image
                  source={{ uri: message.sharedPost.photoUrl }}
                  style={styles.sharedPhoto}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.sharedPhoto} />
              )}
              {/* The card sets its own colours instead of taking the
                bubble's. It sat on a pale panel while inheriting the
                dark bubble's inverse text, which on my own messages
                came out white on near-white. A card is a card whoever
                sent it. */}
              <View style={styles.sharedText}>
                <Text variant="caption" tone="muted">
                  @{message.sharedPost.authorUsername}
                </Text>
                <Text variant="bodySmall" tone="primary" numberOfLines={2}>
                  {message.sharedPost.caption || 'Shared a look'}
                </Text>
                <View style={styles.sharedCta}>
                  <Text variant="caption" tone="muted" uppercase={false}>
                    Tap to open
                  </Text>
                  <Icon name="chevron-forward" size={14} tint={color.icon.muted} />
                </View>
              </View>
            </Pressable>
          ) : null}
          {message.sharedListing ? (
            <SharedListingCard
              item={message.sharedListing}
              onPress={() =>
                router.push({
                  pathname: '/listing/[id]',
                  params: { id: message.sharedListing!.listingId },
                })
              }
            />
          ) : null}
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
              style={
                message.photo || message.sharedPost || message.sharedListing
                  ? styles.captionUnderPhoto
                  : undefined
              }
            >
              {message.body}
            </Text>
          ) : null}
          {hearts > 0 ? (
            <Pressable
              // Tapping the heart takes hers back, or adds hers to theirs.
              onPress={() => onSetLiked(!likedByMe)}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel={likedByMe ? 'Remove your heart' : 'Heart this message too'}
              style={[styles.heart, mine ? styles.heartMine : styles.heartTheirs]}
            >
              <Icon name="heart" size={12} tint={color.status.error} />
              {hearts > 1 ? (
                <Text variant="caption" tone="primary" uppercase={false}>
                  2
                </Text>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </SwipeToReply>
  );
}

/**
 * The quoted message at the top of a reply.
 *
 * Its own pale panel whoever sent the reply, for the same reason as the
 * shared-look card: inheriting the dark bubble's colours made it vanish.
 */
function Quote({
  reply,
  name,
  gone,
  onPress,
}: {
  reply: MessageReply;
  name: string;
  gone: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Replying to ${name}. Tap to see the original.`}
      style={styles.quote}
    >
      <Text variant="caption" tone="muted">
        {name}
      </Text>
      <Text variant="bodySmall" tone={gone ? 'muted' : 'secondary'} numberOfLines={2}>
        {gone ? 'Message unavailable' : replyPreview(reply)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerAvatar: {
    width: controls.minTapTarget,
    height: controls.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  // Room for the heart hanging off the bottom of the bubble.
  rowHearted: { marginBottom: spacing.md },
  heart: {
    position: 'absolute',
    bottom: -spacing.sm - 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: color.surface.page,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.default,
  },
  // Tucked into the inner corner, the side facing the conversation.
  heartMine: { left: spacing.sm },
  heartTheirs: { right: spacing.sm },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
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
    fontFamily: fonts.body,
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
  quote: {
    minWidth: 160,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: color.border.accent,
    backgroundColor: color.surface.page,
    gap: 2,
  },
  // A cream band, like the reply strip: information, not an alarm.
  requestBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    backgroundColor: color.surface.section,
  },
  requestText: { flex: 1 },
  requestDelete: {
    minHeight: controls.minTapTarget,
    minWidth: controls.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    backgroundColor: color.surface.section,
  },
  replyBarText: {
    flex: 1,
    gap: 2,
    borderLeftWidth: 3,
    borderLeftColor: color.border.accent,
    paddingLeft: spacing.sm,
  },
  // Tucked under her own bubble on the right, small and quiet — it
  // answers a question she has, it is not something to act on.
  receipt: { alignSelf: 'flex-end', marginTop: 2, marginRight: spacing.xs },
  sharedPost: {
    width: 232,
    borderRadius: radius.md,
    overflow: 'hidden',
    // Always the page colour, never the bubble's. On my own messages
    // the bubble is near-black and anything inheriting it disappeared.
    backgroundColor: color.surface.page,
    borderWidth: 1,
    borderColor: color.border.default,
  },
  sharedPhoto: { width: '100%', height: 232, backgroundColor: color.surface.muted },
  sharedText: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: 3 },
  sharedCta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
});
