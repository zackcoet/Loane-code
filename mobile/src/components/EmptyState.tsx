/**
 * The empty states from the mockups.
 *
 * Every list in Loane starts empty, and at launch most of them will BE
 * empty for a while. They are part of the product, not an afterthought:
 * "No looks yet — be the first to post an outfit from your campus."
 */

import { StyleSheet, Text, View } from 'react-native';
import {
  color,
  spacing,
  type,
} from '@loane/shared';
import { Button } from './Button';

interface Props {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="outline" onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    // flex:1 centres it in a full-height screen, but inside a
    // ScrollView there is no height to fill, so it collapses to its
    // own text and ends up jammed under whatever is above it — which
    // is what "No posts yet" was doing on a profile. A floor keeps it
    // breathing either way.
    minHeight: 220,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: type.label.size,
    letterSpacing: type.label.letterSpacing,
    textTransform: 'uppercase',
    color: color.text.secondary,
    textAlign: 'center',
  },
  body: {
    marginTop: spacing.md,
    fontSize: type.body.size,
    lineHeight: type.body.lineHeight,
    color: color.text.muted,
    textAlign: 'center',
    maxWidth: 300,
  },
  action: { marginTop: spacing.xl, minWidth: 220 },
});
