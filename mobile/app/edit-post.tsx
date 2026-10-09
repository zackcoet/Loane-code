/**
 * Edit a look.
 *
 * Only the caption and the occasion tags. Photos and tags are fixed once
 * published — changing them would have to move tagCount on other people's
 * listings, and letting a post quietly become a different post is not
 * something a feed should allow.
 *
 * Deleting is soft: it disappears everywhere, and the row survives
 * because its likes and tap-throughs are evidence about whether the
 * social side drives rentals.
 */

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  COLLECTIONS,
  LIMITS,
  OCCASIONS,
  OCCASION_LABELS,
  color,
  spacing,
  type Occasion,
  type Post,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { Chip } from '../src/components/Chip';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Input } from '../src/components/Input';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { db } from '../src/firebase/config';
import { deletePost } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { logEvent } from '../src/analytics/events';

export default function EditPost() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      doc(db, COLLECTIONS.posts, id),
      (snap) => {
        setPost(snap.exists() ? { ...(snap.data() as Post), id: snap.id } : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [id]);

  useEffect(() => {
    if (!post || hydrated) return;
    setCaption(post.caption);
    setOccasions(post.occasions);
    setHydrated(true);
  }, [post, hydrated]);

  const onSave = async () => {
    if (!post) return;
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, COLLECTIONS.posts, post.id), {
        caption: caption.trim(),
        occasions,
        updatedAt: serverTimestamp(),
      });
      logEvent('post_edit', { surface: 'feed', targetType: 'post', targetId: post.id });
      router.back();
    } catch {
      setError('Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!post) return;
    Alert.alert('Delete this look?', 'It comes off your profile and out of the feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setRemoving(true);
          try {
            await deletePost({ postId: post.id });
            logEvent('post_delete', { surface: 'feed', targetType: 'post', targetId: post.id });
            router.back();
          } catch (err) {
            Alert.alert('Loane', callableErrorMessage(err, 'Could not delete that. Try again.'));
          } finally {
            setRemoving(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen flush>
        <Header title="Edit" onBack={() => router.back()} />
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      </Screen>
    );
  }

  if (!post || post.status === 'removed') {
    return (
      <Screen flush>
        <Header title="Edit" onBack={() => router.back()} />
        <EmptyState title="Not found" body="That look is gone." />
      </Screen>
    );
  }

  if (post.authorUid !== profile?.uid) {
    return (
      <Screen flush>
        <Header title="Edit" onBack={() => router.back()} />
        <EmptyState title="Not yours" body="You can only edit your own looks." />
      </Screen>
    );
  }

  return (
    <Screen flush>
      <Header title="Edit Look" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input
            label="Caption"
            value={caption}
            onChangeText={setCaption}
            placeholder="Tell the story of this look…"
            multiline
            numberOfLines={3}
            maxLength={LIMITS.postCaption.max}
            style={styles.multiline}
          />

          <Text variant="label">Event / occasion</Text>
          <View style={styles.chipRow}>
            {OCCASIONS.map((value) => (
              <Chip
                key={value}
                label={OCCASION_LABELS[value]}
                active={occasions.includes(value)}
                onPress={() =>
                  setOccasions((current) =>
                    current.includes(value)
                      ? current.filter((o) => o !== value)
                      : [...current, value],
                  )
                }
              />
            ))}
          </View>

          <Text variant="caption" tone="muted" style={styles.note}>
            Photos and tags are fixed once a look is published.
          </Text>

          {error ? (
            <Text variant="bodySmall" tone="error" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button label="Save changes" onPress={onSave} loading={saving} style={styles.save} />
          <Button
            label="Delete this look"
            variant="outline"
            onPress={onDelete}
            loading={removing}
            style={styles.delete}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  multiline: { height: 88, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  note: { marginTop: spacing.lg },
  error: { marginTop: spacing.md },
  save: { marginTop: spacing.lg },
  delete: { marginTop: spacing.sm },
});
