/**
 * Account Settings, matching the mockup.
 *
 * Campus Email is shown but not editable — the address is what her whole
 * campus claim rests on, and the security rules refuse to let the app
 * change it. Linked Bank Account is a placeholder until Phase 5.
 */

import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { signOut } from 'firebase/auth';
import {
  fonts,
  color,
  controls,
  iconSize,
  spacing,
  type as typography,
  type LegalDocKind,
} from '@loane/shared';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { Header } from '../src/components/Header';
import { LegalDocumentModal } from '../src/components/LegalDocumentModal';
import { useUserSettings } from '../src/hooks/useUserSettings';
import { deleteTryOnData, exportMyData } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { useTryOnEnabled } from '../src/hooks/useTryOn';
import { formatPhone } from '@loane/shared';
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
  const [legalOpen, setLegalOpen] = useState<LegalDocKind | null>(null);
  // Her campus email is no longer on the public profile — it is hers
  // and an admin's to read, and nobody else's.
  const { settings, save } = useUserSettings();
  const tryOnOn = useTryOnEnabled();

  /**
   * Removing her number is a real privacy control, not a cosmetic one:
   * the syncPhoneHash trigger deletes her entry from `phoneHashes` the
   * moment this saves, and from then on nobody's contacts match her.
   * The confirmation says exactly that, because "Remove" on its own
   * does not tell her what stops happening.
   */
  const onRemovePhone = () => {
    Alert.alert(
      'Remove your phone number?',
      "You'll stop showing up when other students check their contacts. Anyone you have a rental with will no longer have a way to reach you about the handoff.",
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void save({ phone: null }),
        },
      ],
    );
  };

  /**
   * Her body photo and every saved look. One tap, no fight.
   *
   * The confirmation says what disappears rather than asking "are you
   * sure" — she should be able to tell exactly what she is getting.
   */
  const onDeleteTryOn = () => {
    Alert.alert(
      'Delete your try-on photos?',
      'Your photo and every look you have saved will be deleted. This cannot be undone.',
      [
        { text: 'Keep them', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteTryOnData()
              .then(() => Alert.alert('Deleted', 'Your try-on photos are gone.'))
              .catch(() => Alert.alert('Loane', 'Could not delete those. Try again.'));
          },
        },
      ],
    );
  };

  /*
    Download my data. The server gathers everything into one file; the
    phone saves it and opens the share sheet, so she can keep it in
    Files, AirDrop it or email it to herself. It is never stored
    anywhere else.
  */
  const [exporting, setExporting] = useState(false);
  const downloadData = async () => {
    setExporting(true);
    try {
      const { data } = await exportMyData();
      const day = new Date().toISOString().slice(0, 10);
      const uri = `${FileSystem.cacheDirectory}loane-my-data-${day}.json`;
      const json = JSON.stringify(data, null, 2);
      await FileSystem.writeAsStringAsync(uri, json);
      // iOS shares the file itself; Android's share sheet only takes text.
      await Share.share(
        Platform.OS === 'ios' ? { url: uri, title: 'My Loane data' } : { message: json },
      );
    } catch (err) {
      Alert.alert('Loane', callableErrorMessage(err, 'Could not get your data. Try again.'));
    } finally {
      setExporting(false);
    }
  };
  const onDownloadData = () => {
    if (exporting) return;
    Alert.alert(
      'Download your data?',
      'We’ll put everything Loane holds about you — profile, pieces, looks, rentals, chats and activity — in one file you can save or send.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => void downloadData() },
      ],
    );
  };

  const rows: Row[] = [
    { label: 'Edit Profile', href: '/edit-profile' },
    { label: 'Notification Preferences', href: '/notification-preferences' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Muted', href: '/muted-users' },
    { label: 'Blocked', href: '/blocked-users' },
    /*
      "Linked Bank Account" is hidden with Payouts, and for the same
      reason: it alerted "coming soon" when tapped, which is a row
      whose only function is to disappoint.
    */
    {
      label: 'Phone Number',
      value: settings?.phone ? formatPhone(settings.phone) : 'Not added',
      // Adding one is an edit; removing one is a privacy decision, and
      // it should not be buried inside a form behind a Save button.
      onPress: settings?.phone ? onRemovePhone : () => router.push('/edit-profile'),
    },
    {
      label: 'Campus Email',
      value: settings?.campusEmail ?? '—',
      readOnly: true,
    },
    /*
      Only while try-on exists. With the feature off there is nothing
      to delete, and a row offering to delete photos she was never
      asked for is worse than no row.
    */
    ...(tryOnOn
      ? [
          {
            label: 'Delete my try-on photos',
            // What goes, in plain words. "Delete my data" tells her
            // nothing.
            onPress: onDeleteTryOn,
          },
        ]
      : []),
    { label: 'Change Password', href: '/change-password' },
    { label: 'Safety', href: '/safety' },
    { label: 'Help & Support', href: '/help' },
    { label: 'Terms & Conditions', onPress: () => setLegalOpen('terms') },
    { label: 'Privacy Policy', onPress: () => setLegalOpen('privacy') },
    {
      label: 'Download my data',
      value: exporting ? 'Preparing…' : undefined,
      onPress: onDownloadData,
    },
    // Apple requires this to be findable in the app, not behind an email.
    { label: 'Delete my account', href: '/delete-account' },
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
                <Icon name="chevron-forward" size={18} tint={color.text.muted} />
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
      <LegalDocumentModal kind={legalOpen} onClose={() => setLegalOpen(null)} />
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
  label: { fontFamily: fonts.body, fontSize: typography.body.size, color: color.text.primary },
  value: {
    fontFamily: fonts.body,
    flexShrink: 1,
    fontSize: typography.bodySmall.size,
    color: color.text.muted,
  },
  chevron: {
    fontFamily: fonts.body,
    fontSize: iconSize.sm,
    color: color.text.muted,
    marginLeft: spacing.sm,
  },
  logOut: {
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
});
