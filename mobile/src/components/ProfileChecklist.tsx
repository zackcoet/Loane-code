/**
 * "Complete your profile" — a card at the top of her own profile.
 *
 * A progress bar and a short list of things she has not done yet.
 * Everything on it is optional and nothing is gated on it; it exists
 * because at launch a half-finished profile is the normal state, and a
 * blank circle with no bio is harder to lend to.
 *
 * COLOUR. The fill is merlot on a cream track. Completing a profile is
 * neither a lender nor a renter action, so the roles say shared — and
 * cherry here would compete with the + button, which is the one thing
 * on this screen we actually want tapped.
 *
 * Done rows stay on the list rather than disappearing. Watching the
 * list get shorter is the point; a row that vanishes the moment you
 * finish it takes the evidence of progress with it.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { color, controls, radius, spacing } from '@loane/shared';
import { Card } from './Card';
import { Icon } from './Icon';
import { Text } from './Text';
import type { ChecklistItem } from '../hooks/useProfileChecklist';

interface Props {
  items: ChecklistItem[];
  completed: number;
  total: number;
  onPressItem: (item: ChecklistItem) => void;
  onDismiss: () => void;
}

export function ProfileChecklist({ items, completed, total, onPressItem, onDismiss }: Props) {
  const remaining = total - completed;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text variant="h3" tone="heading">
            Complete your closet
          </Text>
          <Text variant="caption" tone="muted" uppercase={false}>
            {remaining === 1 ? '1 thing left' : `${remaining} things left`} · all optional
          </Text>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Hide this"
          style={styles.dismiss}
        >
          <Icon name="close" size={16} tint={color.text.muted} />
        </Pressable>
      </View>

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel={`${completed} of ${total} done`}
      >
        {/* Width as a percentage string: the track is full-bleed inside
            the card and its pixel width is not known here. */}
        <View style={[styles.fill, { width: `${Math.round((completed / total) * 100)}%` }]} />
      </View>

      <View style={styles.rows}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => onPressItem(item)}
            accessibilityRole="button"
            accessibilityState={{ checked: item.done }}
            accessibilityLabel={`${item.label}${item.done ? ', done' : ''}`}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={[styles.check, item.done && styles.checkOn]}>
              {item.done ? <Icon name="checkmark" size={13} tint={color.text.inverse} /> : null}
            </View>
            <View style={styles.rowText}>
              <Text
                variant="bodySmall"
                tone={item.done ? 'muted' : 'primary'}
                uppercase={false}
                style={item.done ? styles.doneLabel : undefined}
              >
                {item.label}
              </Text>
              {/* The reason is only useful before she does it. */}
              {item.done ? null : (
                <Text variant="caption" tone="muted" uppercase={false}>
                  {item.hint}
                </Text>
              )}
            </View>
            {item.done ? null : (
              <Icon name="chevron-forward" size={16} tint={color.icon.muted} />
            )}
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headText: { flex: 1, gap: 2 },
  dismiss: { padding: 2 },
  track: {
    height: 6,
    marginTop: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: color.surface.section,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: color.role.shared.background },
  rows: { marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: controls.minTapTarget,
    paddingVertical: spacing.xs,
  },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 1 },
  doneLabel: { textDecorationLine: 'line-through' },
  check: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: color.role.shared.background,
    borderColor: color.role.shared.border,
  },
});
