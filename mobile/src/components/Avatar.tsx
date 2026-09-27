/**
 * A round profile photo, falling back to her initial when there is none.
 */

import { Image, StyleSheet, Text, View } from 'react-native';
import {
  color,
} from '@loane/shared';

interface Props {
  url?: string | null;
  /** Used for the fallback initial. */
  name?: string | null;
  size?: number;
}

export function Avatar({ url, name, size = 48 }: Props) {
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (url) {
    return <Image source={{ uri: url }} style={[styles.base, shape]} resizeMode="cover" />;
  }

  const initial = (name ?? '').trim().charAt(0).toUpperCase();

  return (
    <View style={[styles.base, styles.fallback, shape]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial || '·'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: color.surface.muted, borderWidth: 1, borderColor: color.border.default },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: color.text.muted, fontWeight: '500' },
});
