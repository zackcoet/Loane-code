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
 *   - 1 generic admin account
 *   - Zack's admin account, when SEED_ADMIN_PASSWORD is set locally
 *   - 10 students, 4 of them flagged as founding closets
 *   - ~30 listings across categories and occasions
 *   - ~18 outfit posts, most tagging a listing
 *   - follows, likes and saves between them
 *
 * Seeded test accounts use the password: loane1234
 * Zack's admin password is read from backend/functions/.env and is never hardcoded.
 */

import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COLLECTIONS,
  OCCASIONS,
  SHOE_SIZES,
  SIZES,
  ids,
  type Campus,
  type Category,
  type Listing,
  type Occasion,
  type Condition,
  type ListingIntent,
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
const ZACK_ADMIN_EMAIL = 'zackcoetzee123@gmail.com';
const CAMPUS_ID = 'university-of-south-carolina';

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    const rawValue = line.slice(eq + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    process.env[key] ??= value;
  }
}

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


/**
 * A curated catalogue rather than random combinations, so the seeded
 * marketplace looks like a real campus: every occasion is represented,
 * every size XS-XL appears, and prices sit where a student would actually
 * set them. Filtering by "Formal, size S, under $40" has to return
 * something, or Discover is impossible to test.
 */
interface SeedItem {
  name: string;
  brand: string | null;
  category: Category;
  size: Size | null;
  shoeSize: ShoeSize | null;
  occasions: Occasion[];
  condition: Condition;
  /** 3-day rental price in whole dollars. */
  rent: number | null;
  /** Sale price in whole dollars, when she is also selling it. */
  sale: number | null;
  /** What the piece is worth, in whole dollars. */
  value: number;
  description: string;
}

const CATALOGUE: SeedItem[] = [
  // --- Formals and weddings ------------------------------------------
  { name: 'Black Satin Slip Dress', brand: 'Reformation', category: 'dresses', size: 'S', shoeSize: null,
    occasions: ['formal', 'going_out', 'date_function'], condition: 'like_new',
    rent: 32, sale: null, value: 220,
    description: 'Bias cut, midi length. Worn once to a formal. Runs true to size.' },
  { name: 'Emerald Satin Gown', brand: 'Show Me Your Mumu', category: 'dresses', size: 'M', shoeSize: null,
    occasions: ['formal', 'wedding'], condition: 'like_new',
    rent: 45, sale: 160, value: 280,
    description: 'Floor length with a low back. Steamed and ready. Zero alterations.' },
  { name: 'Champagne Sequin Mini', brand: 'For Love & Lemons', category: 'dresses', size: 'XS', shoeSize: null,
    occasions: ['formal', 'going_out', 'graduation'], condition: 'good',
    rent: 38, sale: null, value: 240,
    description: 'Fully lined, heavier than it looks. A few sequins replaced, invisible when worn.' },
  { name: 'Navy Wrap Midi', brand: 'Aritzia', category: 'dresses', size: 'L', shoeSize: null,
    occasions: ['wedding', 'formal', 'graduation'], condition: 'like_new',
    rent: 30, sale: null, value: 180,
    description: 'The safe wedding-guest dress. Adjustable wrap so it fits a range.' },
  { name: 'White Eyelet Two-Piece', brand: 'Free People', category: 'sets', size: 'M', shoeSize: null,
    occasions: ['graduation', 'vacation'], condition: 'new_with_tags',
    rent: 28, sale: 95, value: 150,
    description: 'Never worn. Perfect for grad photos. Top and skirt sold together.' },

  // --- Gameday ---------------------------------------------------------
  { name: 'Garnet Gameday Dress', brand: 'Princess Polly', category: 'dresses', size: 'S', shoeSize: null,
    occasions: ['gameday'], condition: 'like_new',
    rent: 22, sale: null, value: 90,
    description: 'Exactly the right garnet. Stretchy, survives a whole Saturday.' },
  { name: 'Garnet Corset Top', brand: 'Princess Polly', category: 'tops', size: 'XS', shoeSize: null,
    occasions: ['gameday', 'going_out'], condition: 'good',
    rent: 14, sale: 35, value: 60,
    description: 'Boned corset, hook and eye back. Pairs with white denim.' },
  { name: 'White Denim Mini Skirt', brand: 'Zara', category: 'bottoms', size: 'M', shoeSize: null,
    occasions: ['gameday', 'going_out', 'vacation'], condition: 'good',
    rent: 12, sale: 28, value: 55,
    description: 'The gameday staple. Mid rise, slight stretch.' },
  { name: 'Black Cowboy Boots', brand: null, category: 'shoes', size: null, shoeSize: '8',
    occasions: ['gameday', 'going_out'], condition: 'well_loved',
    rent: 20, sale: null, value: 140,
    description: 'Broken in, which is the point. Genuinely comfortable all day.' },

  // --- Rush ------------------------------------------------------------
  { name: 'Ivory Linen Set', brand: 'Aritzia', category: 'sets', size: 'S', shoeSize: null,
    occasions: ['rush', 'vacation'], condition: 'like_new',
    rent: 26, sale: null, value: 170,
    description: 'Rush week day three. Breathable, does not wrinkle badly.' },
  { name: 'Pastel Pink Midi', brand: 'Zara', category: 'dresses', size: 'L', shoeSize: null,
    occasions: ['rush', 'wedding'], condition: 'like_new',
    rent: 24, sale: null, value: 110,
    description: 'Soft pink, knee grazing. Sleeves so no reapplying sunscreen.' },
  { name: 'Structured Tote', brand: null, category: 'bags', size: null, shoeSize: null,
    occasions: ['rush', 'graduation'], condition: 'good',
    rent: 10, sale: 40, value: 70,
    description: 'Fits a folder and a water bottle. Looks put together.' },

  // --- Going out -------------------------------------------------------
  { name: 'Vintage Silk Slip Dress', brand: null, category: 'dresses', size: 'XS', shoeSize: null,
    occasions: ['going_out', 'date_function'], condition: 'well_loved',
    rent: 18, sale: 45, value: 80,
    description: 'True vintage, real silk. Tiny mark on the hem, does not show.' },
  { name: 'Black Faux Leather Pants', brand: 'Urban Outfitters', category: 'bottoms', size: 'M', shoeSize: null,
    occasions: ['going_out', 'date_function'], condition: 'like_new',
    rent: 16, sale: null, value: 75,
    description: 'High waisted, actually stretchy. Not the plasticky kind.' },
  { name: 'Ruffle Halter Top', brand: 'Princess Polly', category: 'tops', size: 'XL', shoeSize: null,
    occasions: ['going_out', 'date_function'], condition: 'like_new',
    rent: 12, sale: 30, value: 50,
    description: 'Ties at the neck so it adjusts. Fully lined.' },
  { name: 'Strappy Heels', brand: null, category: 'shoes', size: null, shoeSize: '7.5',
    occasions: ['going_out', 'formal'], condition: 'good',
    rent: 14, sale: null, value: 85,
    description: 'Three inch block heel, so you can walk in them.' },

  // --- Date functions --------------------------------------------------
  { name: 'Gingham Mini Dress', brand: 'Free People', category: 'dresses', size: 'S', shoeSize: null,
    occasions: ['date_function', 'gameday', 'vacation'], condition: 'like_new',
    rent: 20, sale: 55, value: 95,
    description: 'Red gingham, square neck. Photographs beautifully.' },
  { name: 'Cropped Denim Jacket', brand: 'Zara', category: 'outerwear', size: 'M', shoeSize: null,
    occasions: ['date_function', 'gameday', 'going_out'], condition: 'good',
    rent: 12, sale: 35, value: 65,
    description: 'Throw over anything. Slightly oversized.' },

  // --- Vacation --------------------------------------------------------
  { name: 'Crochet Beach Set', brand: 'Free People', category: 'sets', size: 'XS', shoeSize: null,
    occasions: ['vacation'], condition: 'like_new',
    rent: 18, sale: 48, value: 90,
    description: 'Spring break staple. Top and shorts, lined.' },
  { name: 'Woven Straw Bag', brand: null, category: 'bags', size: null, shoeSize: null,
    occasions: ['vacation', 'going_out'], condition: 'good',
    rent: 8, sale: 25, value: 45,
    description: 'Roomy enough for a towel and sunscreen.' },
  { name: 'Tortoise Sunglasses', brand: null, category: 'accessories', size: null, shoeSize: null,
    occasions: ['vacation', 'gameday'], condition: 'good',
    rent: 6, sale: 18, value: 40,
    description: 'Oversized frames. Case included.' },

  // --- Graduation and jewellery ----------------------------------------
  { name: 'Gold Hoop Set', brand: null, category: 'jewelry', size: null, shoeSize: null,
    occasions: ['graduation', 'formal', 'going_out'], condition: 'like_new',
    rent: 5, sale: 20, value: 35,
    description: 'Three pairs, small to large. Gold plated, not real gold.' },
  { name: 'Pearl Drop Earrings', brand: null, category: 'jewelry', size: null, shoeSize: null,
    occasions: ['wedding', 'formal', 'graduation'], condition: 'new_with_tags',
    rent: 6, sale: 22, value: 40,
    description: 'Freshwater pearls. Never worn.' },
  { name: 'Cream Cropped Cardigan', brand: 'Aritzia', category: 'outerwear', size: 'L', shoeSize: null,
    occasions: ['graduation', 'rush'], condition: 'like_new',
    rent: 10, sale: 32, value: 60,
    description: 'Layer for a cold lecture hall or a chilly evening.' },
  { name: 'Black Wide Leg Trousers', brand: 'Aritzia', category: 'bottoms', size: 'XL', shoeSize: null,
    occasions: ['graduation', 'formal'], condition: 'like_new',
    rent: 15, sale: null, value: 110,
    description: 'Tailored, full length. Hemmed for about 5 foot 7 in flats.' },
  { name: 'Linen Button Down', brand: 'Zara', category: 'tops', size: 'M', shoeSize: null,
    occasions: ['vacation', 'rush', 'graduation'], condition: 'good',
    rent: 9, sale: 24, value: 45,
    description: 'Oversized, wears as a shirt or a cover-up.' },

  // --- Sale only, so the buy-without-renting path has real data --------
  { name: 'Polka Dot Mini Dress', brand: 'Urban Outfitters', category: 'dresses', size: 'S', shoeSize: null,
    occasions: ['going_out', 'date_function'], condition: 'good',
    rent: null, sale: 32, value: 70,
    description: 'Selling, not renting — it no longer fits me. Great condition.' },
  { name: 'Suede Ankle Boots', brand: null, category: 'shoes', size: null, shoeSize: '9',
    occasions: ['going_out', 'gameday'], condition: 'well_loved',
    rent: null, sale: 45, value: 120,
    description: 'Selling these on. Scuff on the left toe, priced for it.' },
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
  loadLocalEnv();
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

  const zackAdminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (zackAdminPassword) {
    const zackAdminRecord = await auth.createUser({
      email: ZACK_ADMIN_EMAIL,
      password: zackAdminPassword,
      displayName: 'Zack Coetzee',
      emailVerified: true,
    });
    await auth.setCustomUserClaims(zackAdminRecord.uid, { admin: true });
    console.warn(`Created admin: ${ZACK_ADMIN_EMAIL} (password read from local .env)`);
  } else {
    console.warn(`Skipped ${ZACK_ADMIN_EMAIL}: SEED_ADMIN_PASSWORD is not set in backend/functions/.env.`);
  }

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

  // Deal the catalogue out across the closets, so founding closets are
  // fuller and every campus filter has something behind it.
  let cursor = 0;
  for (const owner of users) {
    const count = owner.isFoundingCloset ? 5 : 2;

    for (let i = 0; i < count; i += 1) {
      const item = CATALOGUE[cursor % CATALOGUE.length]!;
      cursor += 1;

      const ref = db.collection(COLLECTIONS.listings).doc();
      const rentable = item.rent != null;
      const intent: ListingIntent =
        rentable && item.sale != null ? 'both' : rentable ? 'rent' : 'sell';

      const listing: Listing = {
        id: ref.id,
        campusId: CAMPUS_ID,
        ownerUid: owner.uid,
        owner: summaryOf(owner),
        name: item.name,
        description: item.description,
        brand: item.brand,
        category: item.category,
        size: item.size,
        shoeSize: item.shoeSize,
        condition: item.condition,
        occasions: item.occasions,
        colorNames: [],
        photos: [image(`users/${owner.uid}/listings/${ref.id}/1.jpg`)],
        coverUrl: PLACEHOLDER,
        intent,
        status: 'active',
        pricing: {
          threeDayCents: item.rent != null ? item.rent * 100 : null,
          // A week is worth more than two three-day rentals to a lender,
          // but less than double to a renter. 1.6x is the usual shape.
          sevenDayCents: item.rent != null ? Math.round(item.rent * 1.6) * 100 : null,
        },
        salePriceCents: item.sale != null ? item.sale * 100 : null,
        garmentValueCents: item.value * 100,
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

    await db.collection(COLLECTIONS.users).doc(owner.uid).update({ 'stats.listingCount': count });
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
  console.warn(`  Password for seeded test accounts: ${PASSWORD}`);

  await deleteApp(app);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
