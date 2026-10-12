/**
 * "Your closet is 50% ready" — a slim strip between her profile and
 * her closet.
 *
 * COLLAPSED BY DEFAULT, and that is the whole design. Her own profile
 * should open with her — photo, name, bio, what she has — not with a
 * list of chores. A full card above the header was impossible to miss
 * and impossible to escape; one line is a reminder she can take or
 * leave, and tapping it gives her the detail she asked for.
 *
 * It sits exactly at the join between who she is and what she has,
 * which is what finishing a profile actually spans.
 *
 * IT GATES NOTHING. Anything genuinely required is asked for at the
 * moment it is needed — see useProfileGate. By the time she reads
 * this strip, photo and phone have usually been handled already and
 * what is left is the softer half: a bio, her sizes, some people to
 * follow. So this is encouragement, and it is allowed to be quiet.
 *
 * COLOUR. Merlot fill on a cream track. Finishing a profile is
 * neither a lender nor a renter action, so the roles say shared — and
 * cherry here would compete with the + button, which is the one thing
 * on this screen we actually want tapped.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, controls, radius, spacing } from '@loane/shared';
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
  const [open, setOpen] = useState(false);
  const percent = Math.round((completed / total) * 100);

  return (
    <View style={styles.band}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Your closet is ${percent} percent ready. ${
          open ? 'Collapse' : 'Expand'
        } the checklist.`}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      >
        <View style={styles.summaryText}>
          <Text variant="bodySmall" tone="heading" uppercase={false} style={styles.strong}>
            Your closet is {percent}% ready
          </Text>
          <View style={styles.track}>
            {/* A percentage string: the track is full width inside the
                strip and its pixel width is not known here. */}
            <View style={[styles.fill, { width: `${percent}%` }]} />
          </View>
        </View>
        <Icon
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={18}
          tint={color.icon.muted}
        />
      </Pressable>

      {open ? (
        <View style={styles.rows}>
          {items.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => onPressItem(item)}
              accessibilityRole="button"
              accessibilityState={{ checked: item.done }}
              accessibilityLabel={`${item.label}${item.done ? ', done' : ''}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
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

          {/* Only reachable once she has opened the strip, which is the
              right order: nothing is dismissed before it is read. */}
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            style={({ pressed }) => [styles.hide, pressed && styles.pressed]}
          >
            <Text variant="caption" tone="muted" uppercase={false} style={styles.hideLabel}>
              Hide this
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.default,
    paddingHorizontal: spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: controls.minTapTarget,
    paddingVertical: spacing.sm,
  },
  summaryText: { flex: 1, gap: spacing.xs },
  strong: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.surface.section,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: color.role.shared.background },
  rows: { paddingBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: controls.minTapTarget,
    paddingVertical: spacing.xs,
  },
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
  hide: { alignSelf: 'center', padding: spacing.sm },
  hideLabel: { textDecorationLine: 'underline' },
});
