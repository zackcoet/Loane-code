/**
 * The sheet that appears when an action needs something she has not
 * added yet.
 *
 * It fills the gap in place and then does the thing she tapped. She is
 * never sent to Edit Profile and abandoned there — the whole point is
 * that she ends up where she was going.
 *
 * It asks for exactly what is missing and nothing else. Somebody who
 * already has a photo and only lacks a phone number sees one field,
 * not a profile form with one empty box in it.
 *
 * "Not now" is always there. Every one of these is an action she chose
 * to start, so closing the sheet cancels that action and nothing else
 * — she is not locked out of anything she had before.
 */

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { color, radius, spacing, validatePhone, normalizePhone } from '@loane/shared';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Input } from './Input';
import { Text } from './Text';
import { useAuth } from '../auth/AuthProvider';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { useUserSettings } from '../hooks/useUserSettings';
import type { ProfileGate } from '../hooks/useProfileGate';

export function ProfileGateSheet({ gate }: { gate: ProfileGate }) {
  const { action, spec, missing, onClose, onComplete } = gate.sheet;
  const { profile } = useAuth();
  const { save } = useUserSettings();
  const photo = useProfilePhoto();

  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A fresh sheet every time. A number she typed and abandoned last
  // time should not be sitting there waiting.
  useEffect(() => {
    if (action) {
      setPhone('');
      setError(null);
    }
  }, [action]);

  if (!action || !spec) return null;

  const needsPhoto = missing.includes('photo');
  const needsPhone = missing.includes('phone');
  // `missing` is recomputed from her live profile, so this flips to
  // false the moment the upload lands — no local mirror to go stale.
  const photoDone = !needsPhoto;

  const onContinue = async () => {
    if (needsPhoto && !profile?.photoUrl) {
      setError('Add a photo to carry on.');
      return;
    }

    if (needsPhone) {
      const check = validatePhone(phone);
      if (!check.ok) return setError(check.error ?? null);
      if (phone.trim().length === 0) return setError('Enter your phone number.');
    }

    setSaving(true);
    setError(null);
    try {
      if (needsPhone) await save({ phone: normalizePhone(phone) });
      onComplete();
    } catch {
      setError('Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* Tapping the dimmed area behind the sheet closes it, which is
          what every sheet on iOS does. */}
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />

      <KeyboardAvoidingView
        style={styles.dock}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text variant="h2" tone="heading">
            {spec.title}
          </Text>
          <Text variant="bodySmall" tone="secondary" uppercase={false} style={styles.reason}>
            {spec.reason}
          </Text>

          {needsPhoto ? (
            <Pressable
              onPress={photo.change}
              accessibilityRole="button"
              accessibilityLabel="Add a profile photo"
              style={styles.photoRow}
            >
              <Avatar url={profile?.photoUrl ?? null} name={profile?.displayName ?? ''} size={56} />
              <View style={styles.photoText}>
                <Text variant="bodySmall" style={styles.strong} uppercase={false}>
                  {photoDone ? 'Photo added' : 'Add a profile photo'}
                </Text>
                <Text variant="caption" tone="muted" uppercase={false}>
                  {photo.uploading ? 'Uploading…' : 'Tap to choose one.'}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {needsPhone ? (
            <Input
              label="Phone number"
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                if (error) setError(null);
              }}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              autoFocus={!needsPhoto}
              hint="Private. Only shared with the other student once this is agreed."
              error={error && !needsPhoto ? error : null}
            />
          ) : null}

          {error && needsPhoto ? (
            <Text variant="caption" tone="error" uppercase={false} style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button label="Continue" onPress={() => void onContinue()} loading={saving} />
          <Button label="Not now" variant="text" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.scrim.behindPanel },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: color.surface.raised,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  reason: { marginTop: -spacing.xs },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photoText: { flex: 1, gap: 2 },
  strong: { fontWeight: '600' },
  error: { marginTop: -spacing.xs },
});
