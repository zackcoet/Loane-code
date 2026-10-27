/**
 * The link that opens a student's profile.
 *
 * Every name and face in the app is a copy of her profile taken at some
 * point — on a look, a piece, a comment, a review, a chat. Her @username
 * can change (she can rename herself), and a review's copy of the
 * reviewer is never refreshed at all. A link by username alone then opens
 * "Closet not found" — or, worse, whoever took the old handle later.
 *
 * So whenever the copy knows her account id, it rides along: the profile
 * screen reads her by id and only uses the handle as a fallback (see
 * useProfileByUsername). The account id never changes.
 */

/** Enough of a person to open her: her handle, and her id when known. */
export interface ProfileRef {
  username: string;
  uid?: string | null;
}

/** Where she tapped through from, for the feed algorithm's profile_view. */
export type ProfileEntryPoint = 'feed' | 'suggested';

export function profileHref(person: ProfileRef, from?: ProfileEntryPoint): string {
  const params: string[] = [];
  if (person.uid) params.push(`uid=${encodeURIComponent(person.uid)}`);
  if (from) params.push(`from=${from}`);
  const path = `/u/${encodeURIComponent(person.username)}`;
  return params.length ? `${path}?${params.join('&')}` : path;
}
