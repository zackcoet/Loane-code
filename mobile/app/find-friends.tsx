/**
 * Find Friends.
 *
 * Search by name or @username across her campus, plus the closets she
 * is already connected to so the screen is not blank before she types.
 *
 * NO CONTACTS IMPORT. It is the obvious next feature and it does not
 * work for us yet: Loane accounts are keyed to a school email address,
 * and an iPhone address book is full of phone numbers. Matching one to
 * the other means storing something derived from her friends' numbers,
 * which is other people's personal data collected without their say.
 * See docs/roadmap.md for what it would actually take.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { color, controls, radius, spacing, type, type UserSummary } from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useStudentSearch, useSuggestedRecipients } from '../src/hooks/useFollowing';
import { useHiddenUids } from '../src/hooks/useBlocks';

export default function FindFriends() {
  const router = useRouter();
  const { profile } = useAuth();
  const [term, setTerm] = useState('');
  const { results, searching } = useStudentSearch(term);
  const { people: known, loading: loadingKnown } = useSuggestedRecipients();
  const hidden = useHiddenUids();

  const typing = term.trim().length >= 2;

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase().replace(/^@/, '');
    if (!typing) return known.filter((p) => !hidden.has(p.uid));
    // Her own people first — a name she half-remembers is usually
    // somebody she already knows — then everyone else on campus.
    const mine = known.filter(
      (p) => p.username.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q),
    );
    const seen = new Set(mine.map((p) => p.uid));
    return [...mine, ...results.filter((r) => !seen.has(r.uid))].filter(
      (p) => !hidden.has(p.uid) && p.uid !== profile?.uid,
    );
  }, [known, results, term, typing, hidden, profile]);

  return (
    <Screen flush>
      <Header title="Find Friends" onBack={() => router.back()} />

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
          <Pressable
            onPress={() => setTerm('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Icon name="close-circle" size={18} tint={color.icon.muted} />
          </Pressable>
        ) : null}
      </View>

      {!typing && loadingKnown ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState
          title={typing ? 'Nobody by that name' : 'Nobody here yet'}
          body={
            typing
              ? searching
                ? 'Still looking…'
                : 'Try her exact @username — search matches the start of a handle.'
              : 'Search for someone, or invite your friends and they will show up here.'
          }
          actionLabel={typing ? undefined : 'Invite friends'}
          onAction={typing ? undefined : () => router.push('/invite-friends')}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.uid}
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            typing ? null : (
              <Text variant="label" tone="muted" style={styles.sectionLabel}>
                Closets you know
              </Text>
            )
          }
          renderItem={({ item }) => <PersonRow person={item} onPress={() => router.push(`/u/${item.username}`)} />}
        />
      )}
    </Screen>
  );
}

function PersonRow({ person, onPress }: { person: UserSummary; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open @${person.username}'s closet`}
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
      <Icon name="chevron-forward" size={18} tint={color.icon.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: { paddingVertical: spacing.sm },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.6 },
  personText: { flex: 1 },
  strong: { fontWeight: '600' },
});
