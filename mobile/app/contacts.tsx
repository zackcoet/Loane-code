/**
 * Find friends from contacts.
 *
 * THE FIRST SCREEN IS THE EXPLANATION, not the permission prompt. She
 * sees what we will do, what leaves her phone and what we keep, and
 * then decides whether to tap. Firing the iOS dialog the instant the
 * screen opens is how apps get a "Don't Allow" from people who would
 * have said yes — and for a request about other people's data, asking
 * before explaining is the wrong order on the merits, not just
 * tactically.
 *
 * The three promises on this screen are real and are enforced
 * elsewhere, not just written here:
 *
 *   "only scrambled numbers"  — useContactMatches hashes on the
 *                               device; raw numbers never leave it
 *   "we never save your
 *    contacts"                — matchContacts writes nothing; there is
 *                               no collection for it to write to
 *   "remove your number
 *    any time"                — Settings → Phone number → Remove,
 *                               which deletes the hash via the
 *                               syncPhoneHash trigger
 *
 * If any of those three stops being true, the copy here is a lie and
 * has to change in the same commit.
 */

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { color, controls, spacing } from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Icon, type IconName } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useContactMatches } from '../src/hooks/useContactMatches';
import { useProfileChecklist } from '../src/hooks/useProfileChecklist';
import { followUser } from '../src/firebase/callables';
import { logEvent } from '../src/analytics/events';

export default function ContactsScreen() {
  const router = useRouter();
  const { state, matches, error, run, markFollowed } = useContactMatches();

  // Ticks "Find your friends" on her profile checklist. Opening the
  // screen is the whole ask — she does not have to grant anything.
  const { markFoundFriends } = useProfileChecklist();
  useEffect(() => {
    void markFoundFriends();
  }, [markFoundFriends]);
  /**
   * Optimistic: the row says Following before the call returns. If it
   * fails she can tap through to the profile and follow there; putting
   * the button back under her finger is worse than being briefly
   * wrong about something she can see and fix.
   */
  const onFollow = async (uid: string) => {
    markFollowed(uid);
    try {
      await followUser({ uid });
      logEvent('follow', {
        surface: 'other',
        targetType: 'user',
        targetId: uid,
        meta: { from: 'contacts' },
      });
    } catch {
      // Deliberately quiet. See above.
    }
  };

  return (
    <Screen flush>
      <Header title="Find Friends" onBack={() => router.back()} />

      {state === 'idle' || state === 'asking' ? (
        <View style={styles.intro}>
          <Text variant="h2" tone="heading">
            See who you already know
          </Text>
          <Text variant="body" tone="secondary" uppercase={false} style={styles.lede}>
            We check your contacts against the students on your campus and show you who is already
            here.
          </Text>

          <Card style={styles.promises}>
            <Promise
              icon="lock-closed-outline"
              title="Only scrambled numbers are sent"
              body="Phone numbers are scrambled on your phone first. We never see the real ones, and never your contacts' names."
            />
            <Promise
              icon="trash-outline"
              title="We never save your contacts"
              body="They are checked and thrown away. Nothing from your address book is stored, here or anywhere."
            />
            <Promise
              icon="settings-outline"
              title="You can take your number back"
              body="Remove your phone number in Settings and you stop matching anybody's contacts straight away."
            />
          </Card>

          <Button
            label="Check my contacts"
            onPress={() => void run()}
            loading={state === 'asking'}
          />
          <Pressable
            onPress={() => router.replace('/find-friends')}
            accessibilityRole="button"
            style={styles.skip}
          >
            <Text variant="bodySmall" tone="secondary" uppercase={false} style={styles.skipLabel}>
              Search by name instead
            </Text>
          </Pressable>
        </View>
      ) : state === 'working' ? (
        <View style={styles.centre}>
          <ActivityIndicator color={color.icon.default} />
          <Text variant="bodySmall" tone="muted" uppercase={false} style={styles.working}>
            Checking…
          </Text>
        </View>
      ) : state === 'denied' ? (
        <EmptyState
          title="No problem"
          body="Loane does not have access to your contacts. You can search for people by name instead, or turn contacts on later in your phone's settings."
          actionLabel="Search by name"
          onAction={() => router.replace('/find-friends')}
        />
      ) : state === 'error' ? (
        <EmptyState
          title="Couldn't check your contacts"
          body={error ?? 'Something went wrong.'}
          actionLabel="Try again"
          onAction={() => void run()}
        />
      ) : matches.length === 0 ? (
        <EmptyState
          title="Nobody yet"
          body="None of your contacts are on Loane at your campus yet. Invite a few and they will show up here."
          actionLabel="Invite friends"
          onAction={() => router.replace('/invite-friends')}
        />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.uid}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text variant="label" tone="muted" style={styles.sectionLabel}>
              {matches.length === 1 ? '1 contact on Loane' : `${matches.length} contacts on Loane`}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.person}>
              <Pressable
                onPress={() => router.push(`/u/${item.username}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open @${item.username}'s closet`}
                style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
              >
                <Avatar url={item.photoUrl} name={item.displayName} size={44} />
                <View style={styles.personText}>
                  <Text variant="bodySmall" style={styles.strong} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    @{item.username}
                  </Text>
                </View>
              </Pressable>

              {item.isFollowing ? (
                <Text variant="caption" tone="muted" style={styles.following}>
                  Following
                </Text>
              ) : (
                <Button
                  label="Follow"
                  variant="dark"
                  onPress={() => void onFollow(item.uid)}
                  style={styles.followButton}
                />
              )}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

function Promise({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.promise}>
      <Icon name={icon} size={18} tint={color.icon.default} />
      <View style={styles.promiseText}>
        <Text variant="bodySmall" style={styles.strong} uppercase={false}>
          {title}
        </Text>
        <Text variant="caption" tone="muted" uppercase={false}>
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  lede: { marginTop: spacing.sm },
  promises: { marginTop: spacing.xl, marginBottom: spacing.xl, gap: spacing.lg },
  promise: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  promiseText: { flex: 1, gap: 2 },
  skip: { alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm },
  skipLabel: { textDecorationLine: 'underline' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  working: {},
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: { paddingVertical: spacing.sm },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: controls.minTapTarget,
  },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.6 },
  personText: { flex: 1 },
  strong: { fontWeight: '600' },
  followButton: { height: 36, paddingHorizontal: spacing.lg },
  following: { paddingHorizontal: spacing.sm },
});
