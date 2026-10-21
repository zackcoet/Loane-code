/**
 * A single look.
 *
 * Reached from a profile's Posts grid, from the Wishlist, or from a
 * listing's "Seen in posts". Same card as the feed, so the behaviour is
 * identical wherever you meet a post.
 */

import { useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS, color, spacing, type Post } from '@loane/shared';
import { useState } from 'react';
import { EmptyState } from '../../src/components/EmptyState';
import { Header } from '../../src/components/Header';
import { PostCard } from '../../src/components/PostCard';
import { ReportSheet } from '../../src/components/ReportSheet';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/auth/AuthProvider';
import { db } from '../../src/firebase/config';
import { useOpenChat } from '../../src/hooks/useOpenChat';
import { useHiddenUids } from '../../src/hooks/useBlocks';
import { logEvent } from '../../src/analytics/events';

export default function PostScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const chat = useOpenChat();
  const hidden = useHiddenUids();

  const [post, setPost] = useState<Post | null>(null);
  const [reporting, setReporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const logged = useRef(false);

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
    if (!post || logged.current) return;
    logged.current = true;
    logEvent('post_view', { surface: 'post', targetType: 'post', targetId: post.id });
  }, [post]);

  return (
    <Screen flush>
      <Header title="Look" onBack={() => router.back()} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : !post || post.status !== 'active' || hidden.has(post.authorUid) ? (
        // Blocked either way reads the same as a deleted look.
        <EmptyState title="Not found" body="That look is no longer up." />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PostCard
            post={post}
            onPressTag={(listingId) => {
              logEvent('tagged_item_tap', {
                surface: 'post',
                targetType: 'listing',
                targetId: listingId,
                meta: { postId: post.id },
              });
              router.push({ pathname: '/listing/[id]', params: { id: listingId } });
            }}
            onPressAuthor={(username) => router.push(`/u/${username}`)}
            onPressComments={() =>
              router.push({
                pathname: '/comments',
                params: { postId: post.id, postAuthorUid: post.authorUid },
              })
            }
            onPressSend={() => router.push({ pathname: '/send-post', params: { postId: post.id } })}
            onPressLikes={() =>
              router.push({ pathname: '/post-likes', params: { postId: post.id } })
            }
            onMessageSeller={(ownerUid, listingId) => void chat.open(ownerUid, { listingId })}
            isMine={post.authorUid === profile?.uid}
            onEdit={
              post.authorUid === profile?.uid
                ? () => router.push({ pathname: '/edit-post', params: { id: post.id } })
                : undefined
            }
            onReport={post.authorUid !== profile?.uid ? () => setReporting(true) : undefined}
          />
        </ScrollView>
      )}

      {post ? (
        <ReportSheet
          visible={reporting}
          onClose={() => setReporting(false)}
          targetType="post"
          targetId={post.id}
          targetUid={post.authorUid}
          targetLabel="this look"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: spacing.sm, paddingBottom: spacing.xxl },
});
