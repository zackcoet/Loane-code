/**
 * Edit Profile.
 *
 * Two different kinds of save happen here, and the difference matters:
 *
 *   - Photo, display name, bio and sizing are written straight to her own
 *     user document. The security rules allow exactly those fields and
 *     nothing else, so this is safe from the app.
 *   - The username goes through the `changeUsername` Cloud Function, which
 *     releases the old handle and claims the new one in one transaction.
 *     The app cannot write a username at all.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  COLLECTIONS,
  LIMITS,
  SHOE_SIZES,
  SIZES,
  colors,
  controls,
  normalizeUsername,
  spacing,
  typography,
  validateBio,
  validateDisplayName,
  validateUsername,
  type ShoeSize,
  type Size,
} from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import { Chip } from '../src/components/Chip';
import { Field } from '../src/components/Field';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useAuth } from '../src/auth/AuthProvider';
import { db } from '../src/firebase/config';
import { changeUsername, checkUsername } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { pickPhoto, uploadProfilePhoto, type PhotoSource } from '../src/lib/photo';
import { logEvent } from '../src/analytics/events';
import { text } from '../src/theme';

export default function EditProfile() {
  const router = useRouter();
  const { profile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile?.photoUrl ?? null);
  const [sizes, setSizes] = useState({
    tops: profile?.sizes.tops ?? null,
    bottoms: profile?.sizes.bottoms ?? null,
    dresses: profile?.sizes.dresses ?? null,
    shoe: profile?.sizes.shoe ?? null,
  });

  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameOk, setUsernameOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!profile) {
    return (
      <Screen flush>
        <ScreenHeader title="Edit Profile" onBack={() => router.back()} />
      </Screen>
    );
  }

  const usernameChanged = normalizeUsername(username) !== profile.username;

  const onUsernameChange = async (value: string) => {
    const next = value.toLowerCase();
    setUsername(next);
    setUsernameOk(null);

    if (normalizeUsername(next) === profile.username) {
      setUsernameError(null);
      return;
    }
    const check = validateUsername(next);
    if (!check.ok) {
      setUsernameError(next.length > 0 ? (check.error ?? null) : null);
      return;
    }
    setUsernameError(null);

    try {
      const result = await checkUsername({ username: normalizeUsername(next) });
      if (result.data.available) setUsernameOk('Available');
      else setUsernameError(result.data.reason ?? 'That username is taken.');
    } catch {
      // Advisory only; changeUsername decides for real.
    }
  };

  const choosePhoto = () => {
    const run = async (source: PhotoSource) => {
      setUploading(true);
      setError(null);
      try {
        const picked = await pickPhoto(source);
        if (!picked) return;
        const url = await uploadProfilePhoto(profile.uid, picked);
        setPhotoUrl(url);
      } catch {
        setError('Could not upload that photo. Try again.');
      } finally {
        setUploading(false);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take a photo', 'Choose from library'], cancelButtonIndex: 0 },
        (index) => {
          if (index === 1) void run('camera');
          if (index === 2) void run('library');
        },
      );
    } else {
      Alert.alert('Profile photo', undefined, [
        { text: 'Take a photo', onPress: () => void run('camera') },
        { text: 'Choose from library', onPress: () => void run('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const onSave = async () => {
    const nameCheck = validateDisplayName(displayName);
    if (!nameCheck.ok) return setError(nameCheck.error ?? null);

    const bioCheck = validateBio(bio);
    if (!bioCheck.ok) return setError(bioCheck.error ?? null);

    if (usernameChanged) {
      const check = validateUsername(username);
      if (!check.ok) return setUsernameError(check.error ?? null);
    }

    setSaving(true);
    setError(null);
    try {
      // The handle first: if it is taken, nothing else should have changed.
      if (usernameChanged) {
        await changeUsername({ username: normalizeUsername(username) });
      }

      await updateDoc(doc(db, COLLECTIONS.users, profile.uid), {
        displayName: displayName.trim(),
        bio: bio.trim(),
        photoUrl,
        sizes,
        updatedAt: serverTimestamp(),
      });

      logEvent('profile_edit', { surface: 'profile', targetType: 'user', targetId: profile.uid });
      router.back();
    } catch (err) {
      const message = callableErrorMessage(err, 'Could not save your profile. Try again.');
      if (usernameChanged) setUsernameError(message);
      else setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen flush>
      <ScreenHeader title="Edit Profile" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            style={styles.photoBlock}
            onPress={choosePhoto}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            <Avatar url={photoUrl} name={displayName} size={96} />
            <Text style={styles.photoAction}>
              {uploading ? 'Uploading…' : 'Change profile photo'}
            </Text>
          </Pressable>

          <Field
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            autoCapitalize="words"
            maxLength={LIMITS.displayName.max}
          />

          <Field
            label="Username"
            value={username}
            onChangeText={onUsernameChange}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={LIMITS.username.max}
            error={usernameError}
            hint={usernameOk ?? 'Others can find and mention you at this name.'}
          />

          <Field
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell renters about your closet"
            multiline
            numberOfLines={3}
            maxLength={LIMITS.bio.max}
            style={styles.bioInput}
            hint={`${bio.length}/${LIMITS.bio.max}`}
          />

          <Text style={[text.label, styles.sizeHeading]}>My sizes</Text>
          <Text style={[text.small, styles.sizeHelp]}>
            Shown on your profile so renters can judge fit.
          </Text>

          <SizePicker
            label="Tops"
            options={SIZES}
            value={sizes.tops}
            onChange={(value) => setSizes((s) => ({ ...s, tops: value as Size | null }))}
          />
          <SizePicker
            label="Bottoms"
            options={SIZES}
            value={sizes.bottoms}
            onChange={(value) => setSizes((s) => ({ ...s, bottoms: value as Size | null }))}
          />
          <SizePicker
            label="Dresses"
            options={SIZES}
            value={sizes.dresses}
            onChange={(value) => setSizes((s) => ({ ...s, dresses: value as Size | null }))}
          />
          <SizePicker
            label="Shoes"
            options={SHOE_SIZES}
            value={sizes.shoe}
            onChange={(value) => setSizes((s) => ({ ...s, shoe: value as ShoeSize | null }))}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Save" onPress={onSave} loading={saving} style={styles.save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function SizePicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <View style={styles.sizeGroup}>
      <Text style={styles.sizeLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sizeScroll}
        contentContainerStyle={styles.sizeRow}
      >
        {options.map((option) => (
          <Chip
            key={option}
            label={option}
            active={value === option}
            // Tapping the selected size clears it.
            onPress={() => onChange(value === option ? null : option)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  photoBlock: { alignItems: 'center', marginBottom: spacing.xl },
  photoAction: {
    marginTop: spacing.md,
    fontSize: typography.bodySmall.size,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  bioInput: { height: 88, textAlignVertical: 'top' },
  sizeHeading: { marginTop: spacing.md },
  sizeHelp: { marginTop: spacing.xs, marginBottom: spacing.md },
  sizeGroup: { marginBottom: spacing.lg },
  sizeLabel: {
    fontSize: typography.bodySmall.size,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sizeScroll: { flexGrow: 0, flexShrink: 0 },
  sizeRow: { gap: spacing.sm, alignItems: 'center', paddingRight: spacing.md },
  error: { color: colors.danger, fontSize: typography.bodySmall.size, marginBottom: spacing.md },
  save: { marginTop: spacing.md, height: controls.buttonHeight },
});
