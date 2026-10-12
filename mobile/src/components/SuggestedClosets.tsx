/**
 * "Suggested for you" — a horizontal row of closets, dropped into the
 * feed every so often.
 *
 * It sits on cream rather than white, which is the one place a band
 * earns its keep now that posts are edge to edge: it marks the row as
 * something other than a look without needing a heading that shouts.
 *
 * Follow is merlot, not cherry. Following somebody is neither a lender
 * nor a renter action — it is the shared case, and the roles say
 * merlot for that.
 */

import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { color, radius, spacing } from '@loane/shared';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';
import { type SuggestedCloset } from '../hooks/useSuggestedClosets';

interface Props {
  closets: SuggestedCloset[];
  onFollow: (uid: string) => void;
  onDismiss: (uid: string) => void;
  onOpen: (username: string) => void;
}

export function SuggestedClosets({ closets, onFollow, onDismiss, onOpen }: Props) {
  if (closets.length === 0) return null;

  return (
    <View style={styles.band}>
      <Text variant="label" tone="heading" style={styles.heading}>
        Closets you might like
      </Text>

      <FlatList
        data={closets}
        keyExtractor={(c) => c.uid}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable
              onPress={() => onDismiss(item.uid)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Dismiss ${item.displayName}`}
              style={styles.dismiss}
            >
              <Icon name="close" size={14} tint={color.text.muted} />
            </Pressable>

            <Pressable
              onPress={() => onOpen(item.username)}
              accessibilityRole="button"
              accessibilityLabel={`Open @${item.username}'s closet`}
              style={styles.identity}
            >
              <Avatar url={item.photoUrl} name={item.displayName} size={64} />
              <Text variant="bodySmall" numberOfLines={1} style={styles.name}>
                {item.displayName}
              </Text>
              {/*
                Only when there are some. "0 mutuals" is worse than
                silence — it tells her she has nothing in common with
                somebody we just recommended.
              */}
              <Text variant="caption" tone="muted" numberOfLines={1} uppercase={false}>
                {item.mutualCount > 0
                  ? `${item.mutualCount} mutual${item.mutualCount === 1 ? '' : 's'}`
                  : `@${item.username}`}
              </Text>
            </Pressable>

            <Button
              label="Follow"
              variant="dark"
              onPress={() => onFollow(item.uid)}
              style={styles.follow}
            />
          </View>
        )}
      />
    </View>
  );
}

const CARD_WIDTH = 150;

const styles = StyleSheet.create({
  band: {
    backgroundColor: color.surface.section,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.default,
  },
  heading: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  row: { paddingHorizontal: spacing.md, gap: spacing.sm },
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: color.surface.raised,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.default,
  },
  dismiss: { position: 'absolute', top: 6, right: 6, padding: 4, zIndex: 1 },
  identity: { alignItems: 'center', gap: 4, width: '100%' },
  name: { fontWeight: '600', textAlign: 'center' },
  follow: { width: '100%', height: 36 },
});
