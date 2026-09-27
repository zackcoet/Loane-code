/**
 * Account Settings, matching the mockup.
 *
 * Campus Email is shown but not editable — the address is what her whole
 * campus claim rests on, and the security rules refuse to let the app
 * change it. Linked Bank Account is a placeholder until Phase 5.
 */

import { useRouter, type Href } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { signOut } from 'firebase/auth';
import {
  brand,
  color,
  controls,
  iconSize,
  spacing,
  type,
} from '@loane/shared';
import { Screen } from '../src/components/Screen';
import { Header } from '../src/components/Header';
import { useAuth } from '../src/auth/AuthProvider';
import { auth } from '../src/firebase/config';

interface Row {
  label: string;
  /** Right-hand value, e.g. her campus email or "Not linked". */
  value?: string;
  href?: Href;
  onPress?: () => void;
  /** No chevron, no press — display only. */
  readOnly?: boolean;
}

export default function Settings() {
  const router = useRouter();
  const { profile } = useAuth();

  const rows: Row[] = [
    { label: 'Edit Profile', href: '/edit-profile' },
    { label: 'Notification Preferences', href: '/notification-preferences' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Blocked', href: '/blocked-users' },
    {
      label: 'Linked Bank Account',
      value: 'Not linked',
      // TODO-PHASE5: Stripe Connect onboarding.
      onPress: () =>
        Alert.alert('Coming soon', 'Payouts and bank details arrive with payments in Phase 5.'),
    },
    {
      label: 'Campus Email',
      value: profile?.campusEmail ?? '—',
      readOnly: true,
    },
    { label: 'Change Password', href: '/change-password' },
    { label: 'Help & Support', href: '/help' },
    {
      label: 'Terms of Service',
      onPress: () => void Linking.openURL(`${brand.website}/terms`),
    },
  ];

  const onLogOut = () => {
    Alert.alert('Log out', 'Log out of Loane?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          router.back();
          await signOut(auth);
        },
      },
    ]);
  };

  return (
    <Screen flush>
      <Header title="Account Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {rows.map((row) =>
          row.readOnly ? (
            <View key={row.label} style={styles.row}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value} numberOfLines={1}>
                {row.value}
              </Text>
            </View>
          ) : (
            <Pressable
              key={row.label}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => {
                if (row.onPress) row.onPress();
                else if (row.href) router.push(row.href);
              }}
            >
              <Text style={styles.label}>{row.label}</Text>
              <View style={styles.rowRight}>
                {row.value ? (
                  <Text style={styles.value} numberOfLines={1}>
                    {row.value}
                  </Text>
                ) : null}
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          ),
        )}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, styles.logOut, pressed && styles.rowPressed]}
          onPress={onLogOut}
        >
          <Text style={styles.label}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: controls.minTapTarget + 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  rowPressed: { backgroundColor: color.surface.muted },
  rowRight: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginLeft: spacing.md },
  label: { fontSize: type.body.size, color: color.text.primary },
  value: { flexShrink: 1, fontSize: type.bodySmall.size, color: color.text.muted },
  chevron: { fontSize: iconSize.sm, color: color.text.muted, marginLeft: spacing.sm },
  logOut: { marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border.default },
});
