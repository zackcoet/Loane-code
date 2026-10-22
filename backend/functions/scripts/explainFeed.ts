/* eslint-disable no-console -- a command-line tool; printing is its job. */
/**
 * Prints the "For You" order for one student, and WHY each look landed
 * where it did — NORTH_STAR D2 / D6.
 *
 *   npx tsx scripts/explainFeed.ts --user ellapetrickcloset
 *
 * EMULATOR ONLY. It refuses to run without FIRESTORE_EMULATOR_HOST
 * (which it defaults to the local emulator), so it cannot read the live
 * project by accident.
 *
 * It uses exactly the same scoring as the app (`rankPosts` in
 * @loane/shared), so if a look is in the wrong place here it is in the
 * wrong place on the phone.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  buildOccasionAffinity,
  diversifyFeed,
  rankPosts,
  toIsoDate,
  type Like,
  type Listing,
  type Occasion,
  type Post,
  type User,
} from '@loane/shared';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.GCLOUD_PROJECT ??= 'demo-loane';
if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCLOUD_PROJECT !== 'demo-loane') {
  console.error('explainFeed only runs against the local emulator (demo-loane).');
  process.exit(1);
}

const CANDIDATES = 60;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const millis = (v: unknown): number | null =>
  v && typeof v === 'object' && 'toMillis' in v ? (v as Timestamp).toMillis() : null;

async function main(): Promise<void> {
  const username = arg('user')?.toLowerCase();
  if (!username) {
    console.error('Usage: npx tsx scripts/explainFeed.ts --user <username>');
    process.exit(1);
  }

  initializeApp({ projectId: 'demo-loane' });
  const db = getFirestore();

  const userSnap = await db
    .collection(COLLECTIONS.users)
    .where('username', '==', username)
    .limit(1)
    .get();
  if (userSnap.empty) throw new Error(`No user @${username}`);
  const me = { ...(userSnap.docs[0]!.data() as User), id: userSnap.docs[0]!.id };

  const [followingSnap, followersSnap, likesSnap, postsSnap] = await Promise.all([
    db.collection(COLLECTIONS.follows).where('followerUid', '==', me.id).get(),
    db.collection(COLLECTIONS.follows).where('followingUid', '==', me.id).get(),
    db.collection(COLLECTIONS.likes).where('uid', '==', me.id).limit(200).get(),
    db
      .collection(COLLECTIONS.posts)
      .where('campusId', '==', me.campusId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(CANDIDATES)
      .get(),
  ]);

  const interactions = new Map<string, number>();
  for (const d of likesSnap.docs) {
    const like = d.data() as Like;
    interactions.set(like.postAuthorUid, (interactions.get(like.postAuthorUid) ?? 0) + 1);
  }

  const posts = postsSnap.docs.map((d) => ({ ...(d.data() as Post), id: d.id }));
  const byId = new Map(posts.map((p) => [p.id, p]));
  const likedOccasions: Occasion[][] = [];
  for (const d of likesSnap.docs) {
    const p = byId.get((d.data() as Like).postId);
    if (p) likedOccasions.push(p.occasions ?? []);
  }

  const listingIds = [...new Set(posts.flatMap((p) => p.taggedListingIds ?? []))];
  const listings = new Map<string, Listing>();
  for (const id of listingIds) {
    const s = await db.collection(COLLECTIONS.listings).doc(id).get();
    if (s.exists) listings.set(id, { ...(s.data() as Listing), id });
  }

  const following = new Set(followingSnap.docs.map((d) => d.get('followingUid') as string));
  const scored = rankPosts(posts, (p) => millis(p.createdAt), {
    viewer: {
      uid: me.id,
      following,
      followers: new Set(followersSnap.docs.map((d) => d.get('followerUid') as string)),
      interactions,
      occasionAffinity: buildOccasionAffinity(likedOccasions),
    },
    listings: (id) => listings.get(id),
    nowMs: Date.now(),
    today: toIsoDate(new Date()),
  });

  // The same variety and discovery rules the app applies (D3). A look
  // the rules moved shows its pure-score place in brackets.
  const scoreRank = new Map(scored.map((r, i) => [r.post.id, i + 1]));
  const ranked = diversifyFeed(
    scored.map((r) => ({ ...r, authorUid: r.post.authorUid })),
    { isFamiliar: (uid) => uid === me.id || following.has(uid) },
  );

  const f = (n: number) => n.toFixed(2);
  console.log(`For You for @${username} — ${ranked.length} looks\n`);
  console.log('#   (was) score  who   what  fresh qual  avail  author / caption');
  ranked.forEach(({ post, breakdown: b }, i) => {
    const p = b.parts;
    console.log(
      `${String(i + 1).padEnd(3)}${scoreRank.get(post.id) === i + 1 ? '     ' : `(${scoreRank.get(post.id)})`.padEnd(5)} ${f(b.score)}   ${f(p.who)}  ${f(p.what)}  ${f(p.fresh)}  ${f(
        p.quality,
      )}  ${f(p.available)}   @${post.author?.username ?? '?'} — ${(post.caption ?? '').slice(0, 40)}`,
    );
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
