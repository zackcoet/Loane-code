/**
 * Profile — her photo, name, bio, stats and the Posts / Closet / Reviews
 * tabs, exactly as laid out in the mockups.
 *
 * Phase 0: the real profile document is read and rendered, with empty
 * states under each tab. Editing is Phase 1; the closet grid is Phase 2.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, controls, spacing, typography } from '@loane/shared';
import { IconButton } from '../../src/components/IconButton';
import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/auth/AuthProvider';
import { text } from '../../src/theme';

const TABS = ['posts', 'closet', 'reviews'] as const;
type ProfileTab = (typeof TABS)[number];

const EMPTY: Record<ProfileTab, { title: string; body: string }> = {
  posts: { title: 'No posts yet', body: 'Looks she posts will show up here.' },
  closet: { title: 'Nothing in the closet yet', body: 'Pieces listed to rent or sell live here.' },
  reviews: { title: 'No reviews yet', body: 'Reviews appear after a completed rental.' },
};

export default function Profile() {
  const router = useRouter();
  const { profile } = useAuth();
  const [tab, setTab] = useState<ProfileTab>('posts');

  if (!profile) {
    return (
      <Screen>
        <EmptyState title="Loading your closet" />
      </Screen>
    );
  }

  const stats = [
    { label: 'Followers', value: profile.stats.followerCount },
    { label: 'Following', value: profile.stats.followingCount },
    { label: 'Items', value: profile.stats.listingCount },
    { label: 'Rentals', value: profile.stats.rentalsAsLender + profile.stats.rentalsAsRenter },
  ];

  return (
    <Screen flush>
      <View style={styles.header}>
        <Text style={styles.handle}>@{profile.username}</Text>
        <IconButton glyph="⚙" onPress={() => router.push('/menu')} accessibilityLabel="Settings" />
      </View>

      <View style={styles.identity}>
        <View style={styles.avatar} />
        <View style={styles.identityText}>
          <Text style={text.h3}>@{profile.username}</Text>
          <Text style={styles.campus}>■ University of South Carolina</Text>
          <Text style={styles.rating}>
            {profile.stats.ratingAverage
              ? `${'★'.repeat(Math.round(profile.stats.ratingAverage))}  (${profile.stats.ratingCount})`
              : '☆☆☆☆☆  (0)'}
          </Text>
        </View>
      </View>

      {profile.bio ? <Text style={[text.small, styles.bio]}>{profile.bio}</Text> : null}

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* TODO-PHASE1: the Edit Profile screen. */}

      <View style={styles.tabRow}>
        {TABS.map((value) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
          >
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value}</Text>
          </Pressable>
        ))}
      </View>

      <EmptyState title={EMPTY[tab].title} body={EMPTY[tab].body} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: controls.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  handle: {
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textPrimary,
  },
  identity: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  identityText: { marginLeft: spacing.md, flex: 1 },
  campus: { fontSize: typography.bodySmall.size, color: colors.textSecondary, marginTop: 2 },
  rating: { fontSize: typography.bodySmall.size, color: colors.textMuted, marginTop: 2 },
  bio: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statValue: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  statLabel: {
    fontSize: typography.caption.size,
    letterSpacing: typography.caption.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 1, borderBottomColor: colors.black },
  tabText: {
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  tabTextActive: { color: colors.textPrimary },
});
