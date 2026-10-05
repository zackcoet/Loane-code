/**
 * Step 5 — see the look exactly as the feed will show it, then share.
 *
 * RENDERED WITH THE REAL PostCard, the same component the feed uses.
 *
 * That is the whole point. A hand-built preview is a promise that the
 * feed will look like this, and it is a promise that quietly breaks the
 * first time somebody changes PostCard and not this screen. Building the
 * preview out of the real thing makes it true by construction instead.
 *
 * The post does not exist yet, so we hand PostCard a Post-shaped object
 * built from the draft, with local file URIs and zeroed counters.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { color, spacing, type ListingSummary, type Post, type PostPhoto } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Header } from '../../src/components/Header';
import { LoaneLoader } from '../../src/components/LoaneLoader';
import { PostCard } from '../../src/components/PostCard';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthProvider';
import { useUserListings } from '../../src/hooks/useProfile';
import { usePostDraft } from '../../src/post/postDraft';
import { createPost } from '../../src/firebase/callables';
import { callableErrorMessage } from '../../src/firebase/errors';
import { uploadPostPhoto } from '../../src/lib/photo';
import { logEvent } from '../../src/analytics/events';
import { useSuccessBanner } from '../../src/components/SuccessBanner';

export default function PostPreview() {
  const router = useRouter();
  const { profile } = useAuth();
  const { items: myListings } = useUserListings(profile?.uid);
  const draft = usePostDraft();
  const banner = useSuccessBanner();
  const [sharing, setSharing] = useState(false);

  if (!profile || draft.photos.length === 0) {
    return (
      <Screen>
        <Header title="Preview" onBack={() => router.back()} />
        <View style={styles.empty}>
          <Text variant="bodySmall" tone="secondary">
            This draft is gone. Start again from the + button.
          </Text>
        </View>
      </Screen>
    );
  }

  const summaryOf = (listingId: string): ListingSummary | null => {
    const listing = myListings.find((l) => l.id === listingId);
    if (!listing) return null;
    return {
      listingId: listing.id,
      name: listing.name,
      coverUrl: listing.coverUrl,
      ownerUid: listing.ownerUid,
      priceCents3Day: listing.pricing?.threeDayCents ?? null,
      salePriceCents: listing.salePriceCents ?? null,
    };
  };

  const photos: PostPhoto[] = draft.photos.map((photo) => ({
    path: '',
    url: photo.picked.uri,
    width: photo.picked.width,
    height: photo.picked.height,
    tags: photo.tags.map((tag) => {
      const listing = myListings.find((l) => l.id === tag.listingId);
      return {
        x: tag.x,
        y: tag.y,
        listingId: tag.listingId,
        ownerUid: profile.uid,
        label: {
          name: listing?.name ?? 'Your piece',
          coverUrl: listing?.coverUrl ?? null,
          priceCents3Day: listing?.pricing?.threeDayCents ?? null,
          salePriceCents: listing?.salePriceCents ?? null,
          ownerUsername: profile.username,
        },
      };
    }),
  }));

  const taggedIds = [...new Set(draft.photos.flatMap((p) => p.tags.map((t) => t.listingId)))];

  // Everything a Post has, with the server-written parts left at zero —
  // this document does not exist yet and nothing here is ever stored.
  const preview: Post = {
    id: 'preview',
    campusId: profile.campusId,
    authorUid: profile.uid,
    author: {
      uid: profile.uid,
      username: profile.username,
      displayName: profile.displayName,
      photoUrl: profile.photoUrl,
      campusId: profile.campusId,
      isVerified: profile.isVerified,
    },
    photos,
    caption: draft.caption.trim(),
    occasions: draft.occasions,
    taggedListings: taggedIds.map(summaryOf).filter((s): s is ListingSummary => s !== null),
    taggedListingIds: taggedIds,
    circleId: null,
    status: 'active',
    stats: {
      likeCount: 0,
      saveCount: 0,
      viewCount: 0,
      tagTapCount: 0,
      commentCount: 0,
      shareCount: 0,
    },
    lastLiker: null,
    suspendedReason: null,
    removedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const onShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      // Photos first: they need somewhere to live before the document
      // can reference them, and a failed upload is better discovered
      // before a post exists than after.
      // A throwaway id just to group this post's photos in storage. The
      // real post id comes back from the server.
      const draftId = `draft-${Date.now()}`;

      const uploaded = [];
      for (const [index, photo] of draft.photos.entries()) {
        const ref = await uploadPostPhoto(profile.uid, draftId, photo.picked, index);
        uploaded.push({
          path: ref.path,
          url: ref.url,
          width: ref.width,
          height: ref.height,
          tags: photo.tags.map((t) => ({ listingId: t.listingId, x: t.x, y: t.y })),
        });
      }

      const result = await createPost({
        photos: uploaded,
        caption: draft.caption.trim(),
        occasions: draft.occasions,
      });

      logEvent('post_create', {
        surface: 'feed',
        targetType: 'post',
        targetId: result.data.postId,
        meta: { photos: uploaded.length, tags: draft.tagCount },
      });

      draft.reset();
      banner.show('Look shared');
      router.dismissAll();
      router.push({ pathname: '/post/[id]', params: { id: result.data.postId } });
    } catch (err) {
      Alert.alert('Could not share', callableErrorMessage(err, 'Try again in a moment.'));
    } finally {
      setSharing(false);
    }
  };

  if (sharing) {
    return (
      <Screen>
        <LoaneLoader fullScreen size={56} label="Sharing your look…" />
      </Screen>
    );
  }

  return (
    <Screen flush>
      <Header title="Preview" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <PostCard
          post={preview}
          isMine
          // Nothing in a preview leads anywhere: the post does not exist,
          // so every action is deliberately inert rather than wired to a
          // screen that would show an empty document.
          onPressTag={() => {}}
          onPressAuthor={() => {}}
          onPressComments={() => {}}
          onPressSend={() => {}}
          onPressLikes={() => {}}
          onMessageSeller={() => {}}
        />
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label="Edit"
          variant="outline"
          onPress={() => router.back()}
          style={styles.footerButton}
        />
        <Button label="Share" onPress={() => void onShare()} style={styles.footerButton} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { paddingBottom: spacing.lg },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
  footerButton: { flex: 1 },
});
