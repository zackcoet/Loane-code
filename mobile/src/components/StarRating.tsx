/**
 * A star rating.
 *
 * SHOWS NOTHING UNTIL SHE HAS BEEN REVIEWED AT LEAST ONCE. Five hollow
 * stars on a new profile reads as "rated badly" rather than "not rated
 * yet", which is unfair to someone who has done nothing wrong. A new
 * student gets no stars, not empty ones.
 */

import { StyleSheet, View } from 'react-native';
import { color, iconSize, radius, spacing } from '@loane/shared';
import { Icon } from './Icon';
import { Text } from './Text';

interface Props {
  average: number | null;
  count: number;
  /** Shown in place of nothing when there are no reviews. */
  emptyLabel?: string;
  /**
   * Leads with the score in a chartreuse tag.
   *
   * For the top of a profile, where a good rating is the strongest
   * reason to rent from someone and deserves to be the thing the eye
   * lands on. Lists of reviews keep the plain stars — a column of
   * accent tags would be noise, not emphasis.
   */
  highlight?: boolean;
}

export function StarRating({ average, count, emptyLabel, highlight = false }: Props) {
  if (count === 0 || average == null) {
    return emptyLabel ? (
      <Text variant="caption" tone="muted" style={styles.empty}>
        {emptyLabel}
      </Text>
    ) : null;
  }

  const filled = Math.round(average);

  return (
    <View style={styles.row} accessibilityLabel={`${average} out of 5, ${count} reviews`}>
      {highlight ? (
        <View style={styles.scoreTag}>
          <Text variant="caption" style={styles.scoreTagText} uppercase={false}>
            {average.toFixed(1)}
          </Text>
        </View>
      ) : null}
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name={n <= filled ? 'star' : 'star-outline'}
          size={iconSize.sm - 4}
          tint={color.text.primary}
        />
      ))}
      <Text variant="bodySmall" tone="muted" style={styles.count}>
        ({count})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  scoreTag: {
    borderRadius: radius.sm,
    backgroundColor: color.accent.background,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    marginRight: spacing.xs,
  },
  scoreTagText: { color: color.accent.label, fontWeight: '600' },
  count: { marginLeft: 4 },
  empty: { marginTop: 4 },
});
