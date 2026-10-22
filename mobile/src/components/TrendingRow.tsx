/**
 * "Trending at USC this week" — a sideways row at the top of Discover.
 *
 * Shown only when she is browsing everything (no search, no filters):
 * once she has narrowed things down, a row of unrelated pieces is noise.
 * Hidden entirely below `MIN_TO_SHOW` pieces — a "trending" row of one is
 * not a trend, and at launch an empty space is better than a thin one.
 */

import { ScrollView, StyleSheet, View } from 'react-native';
import { type Listing, spacing } from '@loane/shared';
import { ListingCard } from './ListingCard';
import { Text } from './Text';

export const MIN_TO_SHOW = 2;

interface Props {
  listings: Listing[];
  /** e.g. "USC". Falls back to "campus". */
  campusShortName: string | null;
  cardWidth: number;
  onPress: (listingId: string) => void;
  onPressOwner: (username: string) => void;
}

export function TrendingRow({
  listings,
  campusShortName,
  cardWidth,
  onPress,
  onPressOwner,
}: Props) {
  if (listings.length < MIN_TO_SHOW) return null;
  const title = campusShortName
    ? `Trending at ${campusShortName} this week`
    : 'Trending on campus this week';

  return (
    <View style={styles.wrap}>
      <Text variant="label" style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // The grid already has the page gutter; pull the row out to the
        // screen edge so cards scroll off it like Instagram's rows.
        style={styles.scroll}
        contentContainerStyle={styles.row}
      >
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            width={cardWidth}
            onPress={onPress}
            onPressOwner={onPressOwner}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  title: { marginBottom: spacing.sm },
  scroll: { marginHorizontal: -spacing.md },
  row: { paddingHorizontal: spacing.md, gap: spacing.md },
});
