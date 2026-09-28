/**
 * Every review a student has received.
 *
 * Reached by tapping her rating, which is where anybody deciding
 * whether to rent from her is already looking. The profile shows the
 * average; this shows the sentences behind it, which is what actually
 * persuades somebody to hand over a dress.
 */

import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { color, spacing, timeAgo, type Review } from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { ReportSheet } from '../src/components/ReportSheet';
import { Screen } from '../src/components/Screen';
import { StarRating } from '../src/components/StarRating';
import { Text } from '../src/components/Text';
import { useReviews } from '../src/hooks/useReviews';
import { useUserById } from '../src/hooks/useProfile';

export default function Reviews() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { reviews, loading } = useReviews(uid);
  const user = useUserById(uid);
  const [reporting, setReporting] = useState<Review | null>(null);

  return (
    <Screen flush>
      <Header title="Reviews" onBack={() => router.back()} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : reviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          body="Reviews appear after a rental is completed, from both sides."
        />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            user ? (
              <View style={styles.summary}>
                <StarRating
                  average={user.stats.ratingAverage}
                  count={user.stats.ratingCount}
                  emptyLabel="No reviews yet"
                />
                <Text variant="bodySmall" tone="muted">
                  {user.displayName} has {reviews.length}{' '}
                  {reviews.length === 1 ? 'review' : 'reviews'}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.review}>
              <View style={styles.head}>
                <Pressable
                  onPress={() => router.push(`/u/${item.author.username}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open @${item.author.username}'s closet`}
                  style={styles.who}
                >
                  <Avatar url={item.author.photoUrl} name={item.author.displayName} size={36} />
                  <View style={styles.whoText}>
                    <Text variant="bodySmall" style={styles.strong}>
                      {item.author.displayName}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {item.authorRole === 'lender' ? 'lent to her' : 'rented from her'} ·{' '}
                      {timeAgo(item.createdAt)}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Icon
                      key={n}
                      name={n <= item.rating ? 'star' : 'star-outline'}
                      size={12}
                      tint={color.text.primary}
                    />
                  ))}
                </View>
              </View>

              {item.body ? (
                <Text variant="bodySmall" style={styles.body}>
                  {item.body}
                </Text>
              ) : null}

              <Text
                variant="caption"
                tone="muted"
                accessibilityRole="button"
                onPress={() => setReporting(item)}
                style={styles.report}
              >
                Report this review
              </Text>
            </View>
          )}
        />
      )}

      <ReportSheet
        visible={reporting !== null}
        targetType="review"
        targetId={reporting?.id ?? ''}
        targetUid={reporting?.authorUid}
        targetLabel={`a review by @${reporting?.author.username ?? ''}`}
        onClose={() => setReporting(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  summary: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
    marginBottom: spacing.sm,
  },
  review: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  whoText: { flex: 1 },
  strong: { fontWeight: '600' },
  stars: { flexDirection: 'row', gap: 2 },
  body: { marginTop: spacing.sm },
  report: { marginTop: spacing.sm },
});
