/**
 * Seed the Firebase emulators with a believable USC campus.
 *
 * Run with the emulators already running:
 *     npm run seed
 *
 * This NEVER touches a real Firebase project. It refuses to run unless the
 * emulator environment variables are set, so a stray run cannot write to
 * loane-dev or loane-code.
 *
 * What it creates:
 *   - the University of South Carolina campus
 *   - 1 admin account
 *   - 10 students, 4 of them flagged as founding closets
 *   - ~30 listings across categories and occasions
 *   - ~18 outfit posts, most tagging a listing
 *   - follows, likes and saves between them
 *
 * Every account uses the password: loane1234
 */

import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  CATEGORIES,
  COLLECTIONS,
  OCCASIONS,
  SHOE_SIZES,
  SIZES,
  ids,
  type Campus,
  type Category,
  type Listing,
  type Occasion,
  type Post,
  type ShoeSize,
  type Size,
  type User,
} from '@loane/shared';

// ---------------------------------------------------------------------------
// Safety: emulators only
// ---------------------------------------------------------------------------

const EMULATOR_VARS = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'] as const;

function assertEmulators(): void {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';
  process.env.GCLOUD_PROJECT ??= 'demo-loane';

  for (const v of EMULATOR_VARS) {
    if (!process.env[v]) {
      throw new Error(`Refusing to seed: ${v} is not set. Start the emulators first.`);
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      'Refusing to seed: GOOGLE_APPLICATION_CREDENTIALS is set, which points at a real project.',
    );
  }
}

const PASSWORD = 'loane1234';
const CAMPUS_ID = 'university-of-south-carolina';

// ---------------------------------------------------------------------------
// Deterministic fake data
// ---------------------------------------------------------------------------

/** Seeded pseudo-random so every run produces the same campus. */
let seed = 42;
function random(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}
function pickSome<T>(items: readonly T[], max: number): T[] {
  const count = 1 + Math.floor(random() * max);
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]!);
  }
  return out;
}
function priceCents(min: number, max: number): number {
  return (min + Math.floor(random() * (max - min))) * 100;
}

/**
 * Flat-colour stand-in avatars, one per founding closet, inlined as PNGs so
 * the profile screens have something distinct to show with no hosting and
 * no network.
 */
const AVATARS: Record<string, string> = {
  ellapetrickcloset:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPI51EHAAGQAKOZ+r+xAAAAAElFTkSuQmCC',
  maddiescloset:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4tsEXAAQzAdQnUT1OAAAAAElFTkSuQmCC',
  sloanerents:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPYWuEDAANfAXoVw3HHAAAAAElFTkSuQmCC',
  reesewears:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPYcfwQAAR8AkKWZ6mhAAAAAElFTkSuQmCC',
};

interface SeedStudent {
  first: string;
  username: string;
  founding: boolean;
  bio?: string;
  sizes?: { tops: Size; bottoms: Size; dresses: Size; shoe: ShoeSize };
}

const STUDENTS: SeedStudent[] = [
  {
    first: 'Ella',
    username: 'ellapetrickcloset',
    founding: true,
    bio: 'Welcome to my closet! No washing or dry cleaning please — I handle all of it.',
    sizes: { tops: 'S', bottoms: 'S', dresses: 'S', shoe: '7.5' },
  },
  {
    first: 'Maddie',
    username: 'maddiescloset',
    founding: true,
    bio: 'Gameday, formals, and everything in between. Pickup near Russell House.',
    sizes: { tops: 'M', bottoms: 'M', dresses: 'M', shoe: '8' },
  },
  {
    first: 'Sloane',
    username: 'sloanerents',
    founding: true,
    bio: 'Vintage finds and going-out sets. Ask me for fit pics!',
    sizes: { tops: 'XS', bottoms: 'S', dresses: 'XS', shoe: '6.5' },
  },
  {
    first: 'Reese',
    username: 'reesewears',
    founding: true,
    bio: 'Sorority formals my specialty. Everything steamed before pickup.',
    sizes: { tops: 'L', bottoms: 'M', dresses: 'M', shoe: '9' },
  },
  { first: 'Caroline', username: 'carolinecloset', founding: false },
  { first: 'Anna', username: 'annagrace', founding: false },
  { first: 'Blair', username: 'blairb', founding: false },
  { first: 'Tatum', username: 'tatumstyle', founding: false },
  { first: 'Harper', username: 'harperhues', founding: false },
  { first: 'Juliet', username: 'julietj', founding: false },
];

const ITEM_NAMES = [
  'Vintage Silk Slip Dress',
  'Pink Party Set',
  'Denim Jacket',
  'Gingham Mini',
  'Polka Dot Mini',
  'Maxi Skirt Set',
  'Boat Neck Top',
  'Garnet Gameday Dress',
  'White Eyelet Two-Piece',
  'Black Satin Slip',
  'Corduroy Wide Leg',
  'Ruffle Halter Top',
  'Floral Midi Dress',
  'Cropped Cardigan',
  'Sequin Mini Dress',
  'Linen Button Down',
  'Suede Ankle Boots',
  'Woven Straw Bag',
  'Gold Hoop Set',
  'Tortoise Sunglasses',
];

const BRANDS = [
  'Free People',
  'Reformation',
  'Zara',
  'Aritzia',
  'Urban Outfitters',
  'Show Me Your Mumu',
  'For Love & Lemons',
  'Princess Polly',
  null,
];

const CAPTIONS = [
  'gameday fit secured',
  'rush week day 3',
  'formal szn',
  'this dress is in my closet if anyone needs it',
  'thrifted and thriving',
  'date function outfit, swipe for details',
  'borrowed this from @maddiescloset and never giving it back',
  'wore this twice, someone else should get to',
  'first game of the season',
  'graduation photos',
];

/**
 * A tiny warm-grey PNG, inlined so seeded photos render with no hosting and
 * no network. React Native's <Image> cannot render an SVG data URI, which is
 * why this is a PNG rather than the obvious one-line SVG.
 */
const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPsauj6DwAFVwJMzKtHDgAAAABJRU5ErkJggg==';

function image(path: string) {
  return { path, url: PLACEHOLDER, width: 600, height: 800, bytes: 1024 };
}

function summaryOf(u: User) {
  return {
    uid: u.uid,
    username: u.username,
    displayName: u.displayName,
    photoUrl: u.photoUrl,
    campusId: u.campusId,
    isVerified: u.isVerified,
  };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function clear(db: Firestore, auth: Auth): Promise<void> {
  for (const name of Object.values(COLLECTIONS)) {
    const snap = await db.collection(name).limit(500).get();
    if (snap.empty) continue;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // Auth users are NOT stored in Firestore, so wiping collections alone
  // leaves the accounts behind and a second seed run dies on
  // "email-already-exists". Clearing both is what makes the seed re-runnable.
  // Safe because assertEmulators() has already refused to run anywhere real.
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    if (page.users.length > 0) {
      await auth.deleteUsers(page.users.map((u) => u.uid));
    }
    pageToken = page.pageToken;
  } while (pageToken);
}

async function main(): Promise<void> {
  assertEmulators();

  const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  const db = getFirestore(app);
  const auth = getAuth(app);

  console.warn('Clearing existing emulator data (Firestore + Auth)…');
  await clear(db, auth);

  // --- Campus -------------------------------------------------------------
  const campus: Omit<Campus, 'createdAt' | 'updatedAt'> = {
    id: CAMPUS_ID,
    name: 'University of South Carolina',
    shortName: 'USC',
    emailDomains: ['sc.edu', 'email.sc.edu'],
    city: 'Columbia',
    state: 'SC',
    // USC garnet. The color only — never the university's logo.
    brandColor: '#73000A',
    isLive: true,
    stats: {
      userCount: 0,
      verifiedUserCount: 0,
      listingCount: 0,
      postCount: 0,
      bookingCount: 0,
    },
  };
  await db.collection(COLLECTIONS.campuses).doc(CAMPUS_ID).set({
    ...campus,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.warn('Created campus: University of South Carolina');

  // --- Admin --------------------------------------------------------------
  const adminRecord = await auth.createUser({
    email: 'admin@joinloane.com',
    password: PASSWORD,
    displayName: 'Loane Admin',
  });
  await auth.setCustomUserClaims(adminRecord.uid, { admin: true });
  console.warn('Created admin: admin@joinloane.com / ' + PASSWORD);

  // --- Students -----------------------------------------------------------
  const users: User[] = [];

  for (const student of STUDENTS) {
    const email = `${student.username}@email.sc.edu`;
    const record = await auth.createUser({
      email,
      password: PASSWORD,
      displayName: student.first,
    });

    const user: User = {
      id: record.uid,
      uid: record.uid,
      username: student.username,
      firstName: student.first,
      displayName: student.first,
      bio: student.bio ?? 'usc • sharing my closet',
      photoUrl: AVATARS[student.username] ?? null,
      campusId: CAMPUS_ID,
      campusEmail: email,
      isVerified: true,
      // Founding closets are verified by hand; everyone else by domain match.
      verificationMethod: student.founding ? 'manual_admin' : 'domain_claimed',
      verifiedAt: FieldValue.serverTimestamp() as never,
      // Nobody has proven inbox control — we do not email a code yet.
      emailConfirmed: false,
      emailConfirmedAt: null,
      sizes: student.sizes ?? {
        tops: pick(SIZES),
        bottoms: pick(SIZES),
        dresses: pick(SIZES),
        shoe: pick(SHOE_SIZES),
      },
      role: 'student',
      status: 'active',
      suspendedReason: null,
      suspendedUntil: null,
      isFoundingCloset: student.founding,
      stats: {
        followerCount: 0,
        followingCount: 0,
        listingCount: 0,
        postCount: 0,
        rentalsAsLender: 0,
        rentalsAsRenter: 0,
        ratingAverage: null,
        ratingCount: 0,
      },
      lastActiveAt: null,
      pushTokens: [],
      stripe: { accountId: null, customerId: null, payoutsEnabled: false },
      createdAt: FieldValue.serverTimestamp() as never,
      updatedAt: FieldValue.serverTimestamp() as never,
    };

    await db.collection(COLLECTIONS.users).doc(record.uid).set(user);
    await db.collection(COLLECTIONS.usernames).doc(student.username).set({
      username: student.username,
      uid: record.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    await db
      .collection(COLLECTIONS.users)
      .doc(record.uid)
      .collection('private')
      .doc('settings')
      .set({
        uid: record.uid,
        accountEmail: email,
        phone: null,
        handoffNotes: 'Usually around Russell House between classes.',
        notificationPreferences: {
          pushEnabled: true,
          rentals: true,
          social: true,
          messages: true,
          marketing: false,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });

    users.push(user);
  }
  console.warn(`Created ${users.length} students (password: ${PASSWORD})`);

  // --- Listings -----------------------------------------------------------
  const listings: Listing[] = [];

  for (const owner of users) {
    const count = owner.isFoundingCloset ? 5 : 2;
    for (let i = 0; i < count; i += 1) {
      const ref = db.collection(COLLECTIONS.listings).doc();
      const category: Category = pick(CATEGORIES);
      const threeDay = priceCents(10, 40);

      const listing: Listing = {
        id: ref.id,
        campusId: CAMPUS_ID,
        ownerUid: owner.uid,
        owner: summaryOf(owner),
        name: pick(ITEM_NAMES),
        description: 'Worn once. Runs true to size. No washing or dry cleaning please!',
        brand: pick(BRANDS),
        category,
        size: category === 'shoes' ? null : (pick(SIZES) as Size),
        shoeSize: null,
        condition: pick(['new_with_tags', 'like_new', 'good'] as const),
        occasions: pickSome(OCCASIONS, 3) as Occasion[],
        colorNames: [],
        photos: [image(`users/${owner.uid}/listings/${ref.id}/1.jpg`)],
        coverUrl: PLACEHOLDER,
        intent: random() > 0.75 ? 'both' : 'rent',
        status: 'active',
        pricing: { threeDayCents: threeDay, sevenDayCents: Math.round(threeDay * 1.6) },
        salePriceCents: random() > 0.75 ? priceCents(40, 160) : null,
        garmentValueCents: priceCents(60, 300),
        // MVP: every request needs the lender's approval.
        requiresApproval: true,
        blackoutDates: [],
        stats: { viewCount: 0, saveCount: 0, tagCount: 0, completedRentals: 0 },
        suspendedReason: null,
        removedAt: null,
        createdAt: FieldValue.serverTimestamp() as never,
        updatedAt: FieldValue.serverTimestamp() as never,
      };

      await ref.set(listing);
      listings.push(listing);
    }

    await db
      .collection(COLLECTIONS.users)
      .doc(owner.uid)
      .update({ 'stats.listingCount': count });
  }
  console.warn(`Created ${listings.length} listings`);

  // --- Posts --------------------------------------------------------------
  let postCount = 0;

  for (const author of users) {
    const count = author.isFoundingCloset ? 3 : 1;
    for (let i = 0; i < count; i += 1) {
      const ref = db.collection(COLLECTIONS.posts).doc();
      const theirListings = listings.filter((l) => l.ownerUid === author.uid);
      const tagged = theirListings.length > 0 && random() > 0.25 ? [pick(theirListings)] : [];

      const post: Post = {
        id: ref.id,
        campusId: CAMPUS_ID,
        authorUid: author.uid,
        author: summaryOf(author),
        photos: [image(`users/${author.uid}/posts/${ref.id}/1.jpg`)],
        caption: pick(CAPTIONS),
        occasions: pickSome(OCCASIONS, 2) as Occasion[],
        taggedListings: tagged.map((l) => ({
          listingId: l.id,
          name: l.name,
          coverUrl: l.coverUrl,
          ownerUid: l.ownerUid,
          priceCents3Day: l.pricing.threeDayCents,
          salePriceCents: l.salePriceCents,
        })),
        taggedListingIds: tagged.map((l) => l.id),
        circleId: null,
        status: 'active',
        stats: { likeCount: 0, saveCount: 0, viewCount: 0, tagTapCount: 0 },
        suspendedReason: null,
        removedAt: null,
        createdAt: FieldValue.serverTimestamp() as never,
        updatedAt: FieldValue.serverTimestamp() as never,
      };

      await ref.set(post);
      postCount += 1;
    }

    await db.collection(COLLECTIONS.users).doc(author.uid).update({ 'stats.postCount': count });
  }
  console.warn(`Created ${postCount} posts`);

  // --- Follows, likes, saves ---------------------------------------------
  const allPosts = await db.collection(COLLECTIONS.posts).get();
  let followCount = 0;
  let likeCount = 0;

  for (const follower of users) {
    for (const target of users) {
      if (follower.uid === target.uid) continue;
      if (random() > 0.45) continue;

      const id = ids.follow(follower.uid, target.uid);
      await db.collection(COLLECTIONS.follows).doc(id).set({
        id,
        followerUid: follower.uid,
        followingUid: target.uid,
        campusId: CAMPUS_ID,
        createdAt: FieldValue.serverTimestamp(),
      });
      await db
        .collection(COLLECTIONS.users)
        .doc(follower.uid)
        .update({ 'stats.followingCount': FieldValue.increment(1) });
      await db
        .collection(COLLECTIONS.users)
        .doc(target.uid)
        .update({ 'stats.followerCount': FieldValue.increment(1) });
      followCount += 1;
    }

    for (const doc of allPosts.docs) {
      const post = doc.data() as Post;
      if (post.authorUid === follower.uid || random() > 0.35) continue;

      const id = ids.like(follower.uid, post.id);
      await db.collection(COLLECTIONS.likes).doc(id).set({
        id,
        uid: follower.uid,
        postId: post.id,
        postAuthorUid: post.authorUid,
        campusId: CAMPUS_ID,
        createdAt: FieldValue.serverTimestamp(),
      });
      await doc.ref.update({ 'stats.likeCount': FieldValue.increment(1) });
      likeCount += 1;
    }

    for (const listing of listings) {
      if (listing.ownerUid === follower.uid || random() > 0.15) continue;
      const id = ids.save(follower.uid, listing.id);
      await db.collection(COLLECTIONS.saves).doc(id).set({
        id,
        uid: follower.uid,
        listingId: listing.id,
        campusId: CAMPUS_ID,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
  console.warn(`Created ${followCount} follows and ${likeCount} likes`);

  // --- Campus counters ----------------------------------------------------
  await db.collection(COLLECTIONS.campuses).doc(CAMPUS_ID).update({
    'stats.userCount': users.length,
    'stats.verifiedUserCount': users.length,
    'stats.listingCount': listings.length,
    'stats.postCount': postCount,
  });

  console.warn('');
  console.warn('Seed complete.');
  console.warn('  Sign in as any student, e.g.  ellapetrickcloset@email.sc.edu');
  console.warn('  Admin dashboard:              admin@joinloane.com');
  console.warn(`  Password for all accounts:    ${PASSWORD}`);

  await deleteApp(app);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
