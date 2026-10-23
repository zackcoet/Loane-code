/**
 * A round profile photo, falling back to her initial when there is none.
 */

import { Image, StyleSheet, Text, View } from 'react-native';
import { color, fontFamilyFor } from '@loane/shared';

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
      <Text
        // The initials sit inside a fixed circle, so they stay the size the circle was drawn for.
        allowFontScaling={false}
        style={[
          styles.initial,
          // Size only; styles.initial carries the family. An avatar's
          // letter scales with its circle, so this cannot be a constant.
          // eslint-disable-next-line no-restricted-syntax
          { fontSize: size * 0.4 },
        ]}
      >
        {initial || '·'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: color.surface.muted, borderWidth: 1, borderColor: color.border.default },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fontFamilyFor('500'), color: color.text.muted, fontWeight: '500' },
});
