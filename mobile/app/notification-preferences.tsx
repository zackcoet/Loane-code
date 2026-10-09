/**
 * Notification Preferences.
 *
 * These write to her private settings today. Nothing sends a push yet —
 * push notifications need a development build rather than Expo Go, and
 * arrive in Phase 6. Setting them now means her choices are already
 * recorded when we switch push on.
 */

import { StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { color, controls, spacing, type } from '@loane/shared';
import { Screen } from '../src/components/Screen';
import { Header } from '../src/components/Header';
import { useUserSettings } from '../src/hooks/useUserSettings';
import { text } from '../src/theme';

type PrefKey = 'pushEnabled' | 'rentals' | 'social' | 'messages' | 'marketing';

const PREFS: { key: PrefKey; label: string; help: string }[] = [
  { key: 'pushEnabled', label: 'Push notifications', help: 'Turn everything on or off.' },
  { key: 'rentals', label: 'Rentals', help: 'Requests, confirmations and return reminders.' },
  { key: 'social', label: 'Social', help: 'New followers and likes on your looks.' },
  { key: 'messages', label: 'Messages', help: 'Direct messages from other students.' },
  { key: 'marketing', label: 'News from Loane', help: 'Occasional updates. Off by default.' },
];

export default function NotificationPreferences() {
  const router = useRouter();
  const { settings, loading, save } = useUserSettings();

  const prefs = settings?.notificationPreferences;

  return (
    <Screen flush>
      <Header title="Notifications" onBack={() => router.back()} />

      <Text style={[text.small, styles.note]}>
        Push notifications arrive in a later release. Your choices are saved now.
      </Text>

      {PREFS.map(({ key, label, help }) => {
        const value = prefs?.[key] ?? false;
        const disabled = loading || (key !== 'pushEnabled' && !(prefs?.pushEnabled ?? false));

        return (
          <View key={key} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
              <Text style={styles.help}>{help}</Text>
            </View>
            <Switch
              value={value}
              disabled={disabled}
              onValueChange={(next) =>
                void save({
                  notificationPreferences: {
                    pushEnabled: prefs?.pushEnabled ?? true,
                    rentals: prefs?.rentals ?? true,
                    social: prefs?.social ?? true,
                    messages: prefs?.messages ?? true,
                    marketing: prefs?.marketing ?? false,
                    [key]: next,
                  },
                })
              }
              trackColor={{ true: color.icon.default, false: color.border.default }}
            />
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: controls.minTapTarget + 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
  rowText: { flex: 1, marginRight: spacing.md },
  label: { fontSize: type.body.size, color: color.text.primary },
  labelDisabled: { color: color.text.muted },
  help: { fontSize: type.bodySmall.size, color: color.text.muted, marginTop: 2 },
});
