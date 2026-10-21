/**
 * One thread in the inbox or the Requests folder.
 *
 * Swipe left for Mute and Delete, like Instagram. The same actions are
 * on long-press and in VoiceOver's actions menu, so a student who never
 * finds the swipe still has them.
 */

import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  color,
  controls,
  iconSize,
  isMutedFor,
  spacing,
  timeAgo,
  type Conversation,
} from '@loane/shared';
import { deleteThreadForMe, setThreadMuted } from '../hooks/useMessaging';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { SwipeActions, type SwipeAction } from './SwipeActions';
import { Text } from './Text';

interface Props {
  conversation: Conversation;
  myUid: string | undefined;
  onPress: () => void;
  /** Requests can be deleted but not muted — nothing to mute yet. */
  canMute?: boolean;
}

export function ThreadRow({ conversation, myUid, onPress, canMute = true }: Props) {
  const otherUid = conversation.participantUids.find((uid) => uid !== myUid);
  const them = otherUid ? conversation.participants?.[otherUid] : undefined;
  const handle = `@${them?.username ?? 'student'}`;
  const muted = myUid ? isMutedFor(conversation, myUid) : false;
  const unread = myUid ? (conversation.unreadCounts?.[myUid] ?? 0) : 0;
  const last = conversation.lastMessage;
  const sentAgo = last ? timeAgo(last.sentAt) : '';

  const toggleMute = () => {
    if (!myUid) return;
    setThreadMuted(conversation.id, myUid, !muted).catch(() =>
      Alert.alert('Loane', 'Could not change that. Try again.'),
    );
  };

  const confirmDelete = () => {
    if (!myUid) return;
    Alert.alert(
      'Delete this chat?',
      `It disappears from your messages only — ${handle} keeps her copy. If either of you sends something new, the chat comes back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void deleteThreadForMe(conversation.id, myUid).catch(() =>
              Alert.alert('Loane', 'Could not delete that chat. Try again.'),
            ),
        },
      ],
    );
  };

  const actions: SwipeAction[] = [
    ...(canMute
      ? [
          {
            label: muted ? 'Unmute' : 'Mute',
            icon: muted
              ? ('notifications-outline' as const)
              : ('notifications-off-outline' as const),
            tone: 'neutral' as const,
            onPress: toggleMute,
          },
        ]
      : []),
    { label: 'Delete', icon: 'trash-outline', tone: 'danger', onPress: confirmDelete },
  ];

  /** The same actions on long-press, for anyone who does not swipe. */
  const showMenu = () => {
    const labels = actions.map((a) => a.label);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...labels],
          cancelButtonIndex: 0,
          destructiveButtonIndex: labels.indexOf('Delete') + 1,
        },
        (i) => {
          if (i > 0) actions[i - 1]?.onPress();
        },
      );
    } else {
      Alert.alert(handle, undefined, [
        ...actions.map((a) => ({ text: a.label, onPress: a.onPress })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  return (
    <SwipeActions actions={actions}>
      <Pressable
        onPress={onPress}
        onLongPress={showMenu}
        accessibilityRole="button"
        accessibilityLabel={`Chat with ${handle}${muted ? ', muted' : ''}${
          unread > 0 ? `, ${unread} unread` : ''
        }`}
        accessibilityActions={actions.map((a) => ({ name: a.label, label: a.label }))}
        onAccessibilityAction={(e) =>
          actions.find((a) => a.label === e.nativeEvent.actionName)?.onPress()
        }
        style={({ pressed }) => [
          styles.row,
          unread > 0 && styles.unreadRow,
          pressed && styles.pressed,
        ]}
      >
        <Avatar url={them?.photoUrl} name={them?.displayName} size={48} />
        <View style={styles.rowText}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {handle}
            </Text>
            {muted ? (
              <Icon name="notifications-off-outline" size={iconSize.sm} tint={color.icon.muted} />
            ) : null}
          </View>
          <View style={styles.previewRow}>
            <Text
              variant="bodySmall"
              tone={unread > 0 ? 'primary' : 'secondary'}
              numberOfLines={1}
              style={styles.preview}
            >
              {/* "You: " on her own last message, so a glance tells her
                whose turn it is. */}
              {last && last.senderUid === myUid ? 'You: ' : ''}
              {last?.body || 'Say hello'}
            </Text>
            {sentAgo ? (
              <Text variant="bodySmall" tone="muted" numberOfLines={1}>
                {' '}
                · {sentAgo}
              </Text>
            ) : null}
          </View>
        </View>
        {unread > 0 ? (
          // A muted thread still shows its own count — muting quiets the
          // badge on the tab, not the thread itself.
          <View style={[styles.badge, muted && styles.mutedBadge]}>
            <Text variant="caption" tone="inverse">
              {unread > 9 ? '9+' : unread}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </SwipeActions>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: controls.minTapTarget + 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
    backgroundColor: color.surface.page,
  },
  unreadRow: { backgroundColor: color.surface.muted },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, marginLeft: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { flexShrink: 1 },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  preview: { flexShrink: 1 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.role.shared.background,
  },
  mutedBadge: { backgroundColor: color.icon.muted },
});
