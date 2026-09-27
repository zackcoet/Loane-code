/**
 * Star rating with the review count beside it.
 * Shows hollow stars until she has been reviewed at least once.
 */

import { StyleSheet, Text, View } from 'react-native';
import {
  color,
  type,
} from '@loane/shared';

interface Props {
  average: number | null;
  count: number;
}

export function StarRating({ average, count }: Props) {
  const filled = average ? Math.round(average) : 0;
  const stars = Array.from({ length: 5 }, (_, i) => (i < filled ? '★' : '☆')).join('');

  return (
    <View style={styles.row}>
      <Text style={styles.stars}>{stars}</Text>
      <Text style={styles.count}>({count})</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  stars: { fontSize: type.bodySmall.size, color: color.text.primary, letterSpacing: 1 },
  count: { marginLeft: 6, fontSize: type.bodySmall.size, color: color.text.muted },
});
