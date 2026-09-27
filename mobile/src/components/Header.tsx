/**
 * The centered uppercase screen title from the mockups ("ACTIVITY",
 * "MY RENTALS", "POST A LOOK") with an optional back chevron.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from './IconButton';
import {
  color,
  controls,
  iconSize,
  type,
} from '@loane/shared';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function Header({ title, onBack, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? (
          <IconButton name="chevron-back" onPress={onBack} accessibilityLabel="Go back" size={iconSize.lg} />
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: controls.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  side: { width: controls.minTapTarget, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: type.label.size,
    letterSpacing: type.label.letterSpacing,
    textTransform: 'uppercase',
    color: color.text.primary,
  },
});
