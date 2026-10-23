/**
 * A labelled on/off row.
 */

import { StyleSheet, Switch, View } from 'react-native';
import { color, controls, spacing } from '@loane/shared';
import { Text } from './Text';

interface Props {
  label: string;
  help?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, help, value, onValueChange, disabled }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text tone={disabled ? 'muted' : 'primary'}>{label}</Text>
        {help ? (
          <Text variant="bodySmall" tone="muted" style={styles.help}>
            {help}
          </Text>
        ) : null}
      </View>
      <Switch
        // The words beside a switch are not attached to it, so without
        // these VoiceOver says only "switch, off" — off what?
        accessibilityLabel={label}
        accessibilityHint={help}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: color.surface.inverse, false: color.border.default }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: controls.minTapTarget,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, marginRight: spacing.md },
  help: { marginTop: 2 },
});
