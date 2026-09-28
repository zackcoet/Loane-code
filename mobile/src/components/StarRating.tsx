/**
 * A star rating.
 *
 * SHOWS NOTHING UNTIL SHE HAS BEEN REVIEWED AT LEAST ONCE. Five hollow
 * stars on a new profile reads as "rated badly" rather than "not rated
 * yet", which is unfair to someone who has done nothing wrong. A new
 * student gets no stars, not empty ones.
 */

import { StyleSheet, View } from 'react-native';
import { color, iconSize } from '@loane/shared';
import { Icon } from './Icon';
import { Text } from './Text';

interface Props {
  average: number | null;
  count: number;
  /** Shown in place of nothing when there are no reviews. */
  emptyLabel?: string;
}

export function StarRating({ average, count, emptyLabel }: Props) {
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
  count: { marginLeft: 4 },
  empty: { marginTop: 4 },
});
