import { LIMITS } from '@loane/shared';
import { pickPhotos } from '../lib/photo';
import type { usePostDraft } from './postDraft';

/**
 * Begin posting a look: open the photo library, then go to Arrange.
 *
 * Three places start this — the + sheet, the empty feed and an empty
 * closet — and all three must behave identically. When each one pushed
 * its own route, "post a look" meant something slightly different
 * depending on where you tapped it.
 *
 * Opening the picker first, rather than a screen of ours holding a
 * "choose photos" button, is what Instagram does and is one tap fewer.
 */
export async function startLook(
  draft: ReturnType<typeof usePostDraft>,
  go: (path: '/new-post/arrange') => void,
): Promise<void> {
  const picked = await pickPhotos(LIMITS.postPhotos.max);
  if (picked.length === 0) return;

  // A new look never inherits the last one's caption, occasions or tags.
  draft.reset();
  draft.addPhotos(picked);
  go('/new-post/arrange');
}
