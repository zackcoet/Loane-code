/**
 * The extras around Discover's search box, the way Instagram's search
 * works:
 *
 *   - RecentSearches: with the box focused and empty, her last few
 *     searches, each removable, with "Clear all".
 *   - SearchSuggestions: while she types, the students whose @name
 *     matches and any occasion the word names ("form" → Formal), above
 *     the pieces that match.
 */

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  OCCASION_LABELS,
  color,
  controls,
  spacing,
  type Occasion,
  type UserSummary,
} from '@loane/shared';
import { Avatar } from './Avatar';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { Text } from './Text';

export function RecentSearches({
  recent,
  onPick,
  onRemove,
  onClear,
}: {
  recent: string[];
  onPick: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
}) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.recent}>
      <View style={styles.recentHeader}>
        <Text variant="label">Recent</Text>
        <Pressable
          onPress={onClear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear all recent searches"
          style={styles.clearAll}
        >
          <Text variant="caption" tone="muted">
            Clear all
          </Text>
        </Pressable>
      </View>
      {recent.map((term) => (
        <View key={term} style={styles.recentRow}>
          <Pressable
            onPress={() => onPick(term)}
            accessibilityRole="button"
            accessibilityLabel={`Search for ${term}`}
            style={styles.recentTerm}
          >
            <Icon name="time-outline" size={16} tint={color.icon.muted} />
            <Text variant="bodySmall" numberOfLines={1} style={styles.flex}>
              {term}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onRemove(term)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${term} from recent searches`}
            style={styles.remove}
          >
            <Icon name="close" size={16} tint={color.icon.muted} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

export function SearchSuggestions({
  people,
  occasions,
  onPickPerson,
  onPickOccasion,
}: {
  people: UserSummary[];
  occasions: Occasion[];
  onPickPerson: (person: UserSummary) => void;
  onPickOccasion: (occasion: Occasion) => void;
}) {
  if (people.length === 0 && occasions.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.suggestScroll}
      contentContainerStyle={styles.suggestRow}
      accessibilityLabel="Suggestions"
    >
      {occasions.map((o) => (
        <Chip key={o} label={`${OCCASION_LABELS[o]} · see all`} onPress={() => onPickOccasion(o)} />
      ))}
      {people.map((person) => (
        <Pressable
          key={person.uid}
          onPress={() => onPickPerson(person)}
          accessibilityRole="button"
          accessibilityLabel={`Open @${person.username}'s closet`}
          style={styles.person}
        >
          <Avatar url={person.photoUrl} name={person.displayName} size={28} />
          <Text variant="caption" uppercase={false} numberOfLines={1}>
            @{person.username}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  recent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: controls.minTapTarget,
  },
  clearAll: { minHeight: controls.minTapTarget, justifyContent: 'center' },
  recentRow: { flexDirection: 'row', alignItems: 'center' },
  recentTerm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: controls.minTapTarget,
  },
  remove: {
    minWidth: controls.minTapTarget,
    minHeight: controls.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestScroll: { flexGrow: 0, flexShrink: 0 },
  suggestRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: controls.minTapTarget,
    paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.default,
  },
});
