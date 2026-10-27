/**
 * One look in the feed, drawn only when THAT look changes.
 *
 * Why this exists: the feed screen re-draws whenever anything on it
 * changes — a new page arrives, the suggestions row loads, she likes
 * something, the tab bar's badge ticks. FlatList then re-draws every
 * card it is holding (up to ~15), each with its photo carousel, even
 * though none of them changed. On an older iPhone that is the stutter
 * you feel while scrolling.
 *
 * `memo` lets a card skip that re-draw when its look, whether it is
 * hers, and the set of actions are all the same as last time. The
 * actions take the look as an argument (instead of being a fresh
 * function per card) so the screen can build them once.
 */

import { memo } from 'react';
import type { Post, ProfileRef } from '@loane/shared';
import { PostCard } from './PostCard';

/** Everything a feed card can do, built once by the feed screen. */
export interface FeedPostActions {
  onPressTag: (listingId: string, postId: string) => void;
  onPressAuthor: (person: ProfileRef) => void;
  onPressComments: (post: Post) => void;
  onPressSend: (post: Post) => void;
  onPressLikes: (post: Post) => void;
  onMessageSeller: (ownerUid: string, listingId: string) => void;
  /** Absent while Try-On is switched off. */
  onTryOnLook?: (listingIds: string[]) => void;
  /** Her own look. */
  onEdit: (post: Post) => void;
  /** Someone else's look: mute or report. */
  onMore: (post: Post) => void;
}

interface Props {
  post: Post;
  isMine: boolean;
  actions: FeedPostActions;
}

export const FeedPostRow = memo(function FeedPostRow({ post, isMine, actions }: Props) {
  return (
    <PostCard
      post={post}
      isMine={isMine}
      onPressTag={(listingId) => actions.onPressTag(listingId, post.id)}
      onPressAuthor={actions.onPressAuthor}
      onPressComments={() => actions.onPressComments(post)}
      onPressSend={() => actions.onPressSend(post)}
      onPressLikes={() => actions.onPressLikes(post)}
      onMessageSeller={actions.onMessageSeller}
      onTryOnLook={actions.onTryOnLook}
      onEdit={isMine ? () => actions.onEdit(post) : undefined}
      onReport={isMine ? undefined : () => actions.onMore(post)}
    />
  );
});
