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
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { demoGarment, garmentPhoto, peoplePhoto } from './seedPhotos';
import { LEGAL_V1_EFFECTIVE_DATE, PRIVACY_V1, TERMS_V1 } from '../src/legal/v1';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  newUserWalkthrough,
  COLLECTIONS,
  OCCASIONS,
  SHOE_SIZES,
  SIZES,
  addDays,
  calculateFees,
  priceForDuration,
  newBookingPayment,
  ids,
  type Booking,
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
  newUserStripe,
  newUserTryOn,
  TRYON_CATEGORY_MAP,
  isTryOnReady,
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

interface SeedStudent {
  first: string;
  username: string;
  founding: boolean;
  bio?: string;
  sizes?: { tops: Size; bottoms: Size; dresses: Size; shoe: ShoeSize };
  /**
   * Zack's own demo account. Its email, password and uid all come from
   * outside the loop: the password from the local .env so it is never
   * in the repo, and the uid FIXED so his body photo in Storage
   * survives a reseed — a demo that needs a new selfie every time is
   * not a demo you can rely on in front of somebody.
   */
  demo?: {
    email: string;
    uid: string;
    passwordEnv: string;
    /** Extra free try-ons, on top of the free five. */
    bonusTryOns: number;
  };
}

const STUDENTS: SeedStudent[] = [
  {
    first: 'Zack',
    username: 'zcoetzee',
    founding: false,
    bio: 'Demo account.',
    sizes: { tops: 'M', bottoms: 'M', dresses: 'M', shoe: '9' },
    demo: {
      email: 'zcoetzee@email.sc.edu',
      // Fixed, so users/zack-demo/tryon/body/... keeps working.
      uid: 'zack-demo',
      passwordEnv: 'SEED_ZACK_PASSWORD',
      bonusTryOns: 50,
    },
  },
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
  /**
   * Which lay-it-flat photo this piece IS. Only the few entries that
   * genuinely describe one of the four clean photos may set it — the
   * flat photo is the garment the try-on renders, so a mismatch here
   * renders the wrong garment convincingly.
   */
  flatFile?: string;
}

/**
 * How many try-on-eligible pieces every seeded student is given in her
 * saves, on top of the random ones. Enough to fill the fitting room
 * row and show both tabs with something in them.
 */
const TRYABLE_SAVES_PER_USER = 8;

/**
 * The demo garments: fifteen pieces Zack generated, categorised from
 * the images rather than their filenames.
 *
 * THESE ARE THE ONLY LISTINGS WITH A LAY-IT-FLAT PHOTO, and the photo
 * is the same file as the listing photo — so the card and the try-on
 * always show the same garment. Prices are what a USC student would
 * actually pay for three days.
 *
 * Dealt out across different closets rather than given to everyone, so
 * the marketplace looks like a campus instead of fifteen identical
 * wardrobes.
 */
const DEMO_GARMENTS: SeedItem[] = [
  // --- Tops -------------------------------------------------------------
  {
    name: 'Black Satin Cowl-Neck Camisole',
    brand: 'Aritzia',
    category: 'tops',
    size: 'S',
    shoeSize: null,
    occasions: ['going_out', 'date_function'],
    condition: 'like_new',
    rent: 12,
    sale: 28,
    value: 65,
    description: 'Black satin cami with a draped cowl neck. Goes with everything, dresses up fast.',
    flatFile: 'demo-camisole.jpg',
  },
  {
    name: 'Burgundy Ribbed Knit Tank',
    brand: 'Brandy Melville',
    category: 'tops',
    size: 'XS',
    shoeSize: null,
    occasions: ['gameday', 'going_out'],
    condition: 'like_new',
    rent: 9,
    sale: 20,
    value: 40,
    description: 'Garnet ribbed tank. Square neck, fitted. Gameday without trying too hard.',
    flatFile: 'demo-tank.jpg',
  },
  {
    name: 'Light Blue Striped Oversized Shirt',
    brand: 'Madewell',
    category: 'tops',
    size: 'M',
    shoeSize: null,
    occasions: ['vacation', 'going_out'],
    condition: 'good',
    rent: 11,
    sale: 26,
    value: 70,
    description: 'Oversized striped button down. Open over a tank or tucked in — both work.',
    flatFile: 'demo-shirt.jpg',
  },
  {
    name: 'White Eyelet Corset Top',
    brand: 'Reformation',
    category: 'tops',
    size: 'S',
    shoeSize: null,
    occasions: ['going_out', 'date_function', 'vacation'],
    condition: 'like_new',
    rent: 14,
    sale: 34,
    value: 85,
    description: 'White eyelet corset with boning and a little tie at the bust. Structured, not stiff.',
    flatFile: 'demo-corset.jpg',
  },

  // --- Outerwear ---------------------------------------------------------
  {
    name: 'Pastel Pink Pearl-Button Cardigan',
    brand: 'Free People',
    category: 'outerwear',
    size: 'S',
    shoeSize: null,
    occasions: ['date_function', 'going_out'],
    condition: 'like_new',
    rent: 13,
    sale: 30,
    value: 75,
    description: 'Cropped pink cardigan with pearl buttons. Throws over a slip dress perfectly.',
    flatFile: 'demo-cardigan.jpg',
  },

  // --- Dresses -----------------------------------------------------------
  {
    name: 'Black Structured Bodycon Mini',
    brand: 'House of CB',
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    occasions: ['going_out', 'date_function'],
    condition: 'like_new',
    rent: 24,
    sale: null,
    value: 160,
    description: 'Black square-neck bodycon. Thick straps, holds its shape, no adjusting all night.',
    flatFile: 'demo-bodycon.jpg',
  },
  {
    name: 'Emerald Satin Cowl-Neck Gown',
    brand: 'Lulus',
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    occasions: ['formal', 'wedding'],
    condition: 'like_new',
    rent: 38,
    sale: null,
    value: 240,
    description: 'Floor-length emerald satin with a cowl neck and a thigh slit. Worn to one formal.',
    flatFile: 'demo-gown.jpg',
  },
  {
    name: 'Ivory Puff-Sleeve Tiered Dress',
    brand: 'Hill House',
    category: 'dresses',
    size: 'M',
    shoeSize: null,
    occasions: ['graduation', 'date_function', 'wedding'],
    condition: 'like_new',
    rent: 26,
    sale: 68,
    value: 150,
    description: 'Ivory midi with puff sleeves and a tiered skirt. Graduation photos, rehearsal dinners.',
    flatFile: 'demo-ivory.jpg',
  },
  {
    name: 'Pastel Blue Floral Tiered Sundress',
    brand: 'For Love & Lemons',
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    occasions: ['vacation', 'date_function'],
    condition: 'like_new',
    rent: 19,
    sale: 45,
    value: 110,
    description: 'Blue floral sundress, ruffled straps, tiered skirt. Lake day into dinner.',
    flatFile: 'demo-bluesundress.jpg',
  },
  {
    name: 'Pastel Yellow Floral Sundress',
    brand: 'Princess Polly',
    category: 'dresses',
    size: 'XS',
    shoeSize: null,
    occasions: ['vacation', 'rush', 'date_function'],
    condition: 'good',
    rent: 17,
    sale: 40,
    value: 95,
    description: 'Yellow floral mini with a sweetheart neck. Rush week, day parties, Easter.',
    flatFile: 'demo-yellowsundress.jpg',
  },
  {
    name: 'Red Gingham Bow-Tie Mini Dress',
    brand: 'Hollister',
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    occasions: ['gameday', 'going_out'],
    condition: 'like_new',
    rent: 18,
    sale: 42,
    value: 90,
    description: 'Red gingham mini with tie straps and a full skirt. Made for a Saturday in Columbia.',
    flatFile: 'demo-ginghamdress.jpg',
  },

  // --- Bottoms. Not tryable yet; see TRYON_COMING_SOON. ------------------
  {
    name: 'Light Blue Straight-Leg Jeans',
    brand: 'Agolde',
    category: 'bottoms',
    size: 'M',
    shoeSize: null,
    occasions: ['going_out', 'gameday'],
    condition: 'good',
    rent: 15,
    sale: 48,
    value: 120,
    description: 'Light wash straight leg, high rise. The pair you reach for without thinking.',
    flatFile: 'demo-jeans.jpg',
  },
  {
    name: 'Light Grey Ruffled Sweat Shorts',
    brand: 'Aerie',
    category: 'bottoms',
    size: 'S',
    shoeSize: null,
    occasions: ['gameday'],
    condition: 'like_new',
    rent: 8,
    sale: 18,
    value: 35,
    description: 'Grey sweat shorts with a ruffle hem and a drawstring. Tailgate comfortable.',
    flatFile: 'demo-sweatshorts.jpg',
  },
  {
    name: 'Light-Wash Frayed Denim Shorts',
    brand: "Levi's",
    category: 'bottoms',
    size: 'S',
    shoeSize: null,
    occasions: ['gameday', 'vacation'],
    condition: 'good',
    rent: 10,
    sale: 24,
    value: 55,
    description: 'High-rise denim shorts with a frayed hem. Every gameday, every year.',
    flatFile: 'demo-denimshorts.jpg',
  },
  {
    name: 'Red Gingham Ruffle Shorts',
    brand: 'Urban Outfitters',
    category: 'bottoms',
    size: 'S',
    shoeSize: null,
    occasions: ['gameday', 'vacation'],
    condition: 'like_new',
    rent: 9,
    sale: 22,
    value: 42,
    description: 'Red gingham ruffle shorts with a tie waist. Pairs with the gingham dress set.',
    flatFile: 'demo-ginghamshorts.jpg',
  },
];

const CATALOGUE: SeedItem[] = [
  // --- Formals and weddings ------------------------------------------
  {
    name: 'Black Satin Slip Dress',
    brand: 'Reformation',
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    occasions: ['formal', 'going_out', 'date_function'],
    condition: 'like_new',
    rent: 32,
    sale: null,
    value: 220,
    description: 'Bias cut, midi length. Worn once to a formal. Runs true to size.',
  },
  {
    name: 'Emerald Satin Gown',
    brand: 'Show Me Your Mumu',
    category: 'dresses',
    size: 'M',
    shoeSize: null,
    occasions: ['formal', 'wedding'],
    condition: 'like_new',
    rent: 45,
    sale: 160,
    value: 280,
    description: 'Floor length with a low back. Steamed and ready. Zero alterations.',
  },
  {
    name: 'Champagne Sequin Mini',
    brand: 'For Love & Lemons',
    category: 'dresses',
    size: 'XS',
    shoeSize: null,
    occasions: ['formal', 'going_out', 'graduation'],
    condition: 'good',
    rent: 38,
    sale: null,
    value: 240,
    description: 'Fully lined, heavier than it looks. A few sequins replaced, invisible when worn.',
  },
  {
    name: 'Navy Wrap Midi',
    brand: 'Aritzia',
    category: 'dresses',
    size: 'L',
    shoeSize: null,
    occasions: ['wedding', 'formal', 'graduation'],
    condition: 'like_new',
    rent: 30,
    sale: null,
    value: 180,
    description: 'The safe wedding-guest dress. Adjustable wrap so it fits a range.',
  },
  {
    name: 'White Eyelet Two-Piece',
    brand: 'Free People',
    category: 'sets',
    size: 'M',
    shoeSize: null,
    occasions: ['graduation', 'vacation'],
    condition: 'new_with_tags',
    rent: 28,
    sale: 95,
    value: 150,
    description: 'Never worn. Perfect for grad photos. Top and skirt sold together.',
  },

  // --- Gameday ---------------------------------------------------------
  {
    name: 'Garnet Gameday Dress',
    brand: 'Princess Polly',
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    occasions: ['gameday'],
    condition: 'like_new',
    rent: 22,
    sale: null,
    value: 90,
    description: 'Exactly the right garnet. Stretchy, survives a whole Saturday.',
  },
  {
    name: 'Garnet Corset Top',
    brand: 'Princess Polly',
    category: 'tops',
    size: 'XS',
    shoeSize: null,
    occasions: ['gameday', 'going_out'],
    condition: 'good',
    rent: 14,
    sale: 35,
    value: 60,
    description: 'Boned corset, hook and eye back. Pairs with white denim.',
  },
  {
    name: 'White Denim Mini Skirt',
    brand: 'Zara',
    category: 'bottoms',
    size: 'M',
    shoeSize: null,
    occasions: ['gameday', 'going_out', 'vacation'],
    condition: 'good',
    rent: 12,
    sale: 28,
    value: 55,
    description: 'The gameday staple. Mid rise, slight stretch.',
  },
  {
    name: 'Black Cowboy Boots',
    brand: null,
    category: 'shoes',
    size: null,
    shoeSize: '8',
    occasions: ['gameday', 'going_out'],
    condition: 'well_loved',
    rent: 20,
    sale: null,
    value: 140,
    description: 'Broken in, which is the point. Genuinely comfortable all day.',
  },

  // --- Rush ------------------------------------------------------------
  {
    name: 'Ivory Linen Set',
    brand: 'Aritzia',
    category: 'sets',
    size: 'S',
    shoeSize: null,
    occasions: ['rush', 'vacation'],
    condition: 'like_new',
    rent: 26,
    sale: null,
    value: 170,
    description: 'Rush week day three. Breathable, does not wrinkle badly.',
  },
  {
    name: 'Pastel Pink Midi',
    brand: 'Zara',
    category: 'dresses',
    size: 'L',
    shoeSize: null,
    occasions: ['rush', 'wedding'],
    condition: 'like_new',
    rent: 24,
    sale: null,
    value: 110,
    description: 'Soft pink, knee grazing. Sleeves so no reapplying sunscreen.',
  },
  {
    name: 'Structured Tote',
    brand: null,
    category: 'bags',
    size: null,
    shoeSize: null,
    occasions: ['rush', 'graduation'],
    condition: 'good',
    rent: 10,
    sale: 40,
    value: 70,
    description: 'Fits a folder and a water bottle. Looks put together.',
  },

  // --- Going out -------------------------------------------------------
  {
    name: 'Vintage Silk Slip Dress',
    brand: null,
    category: 'dresses',
    size: 'XS',
    shoeSize: null,
    occasions: ['going_out', 'date_function'],
    condition: 'well_loved',
    rent: 18,
    sale: 45,
    value: 80,
    description: 'True vintage, real silk. Tiny mark on the hem, does not show.',
  },
  {
    name: 'Black Faux Leather Pants',
    brand: 'Urban Outfitters',
    category: 'bottoms',
    size: 'M',
    shoeSize: null,
    occasions: ['going_out', 'date_function'],
    condition: 'like_new',
    rent: 16,
    sale: null,
    value: 75,
    description: 'High waisted, actually stretchy. Not the plasticky kind.',
  },
  {
    name: 'Ruffle Halter Top',
    brand: 'Princess Polly',
    category: 'tops',
    size: 'XL',
    shoeSize: null,
    occasions: ['going_out', 'date_function'],
    condition: 'like_new',
    rent: 12,
    sale: 30,
    value: 50,
    description: 'Ties at the neck so it adjusts. Fully lined.',
  },
  {
    name: 'Strappy Heels',
    brand: null,
    category: 'shoes',
    size: null,
    shoeSize: '7.5',
    occasions: ['going_out', 'formal'],
    condition: 'good',
    rent: 14,
    sale: null,
    value: 85,
    description: 'Three inch block heel, so you can walk in them.',
  },

  // --- Date functions --------------------------------------------------
  {
    name: 'Gingham Mini Dress',
    brand: 'Free People',
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    occasions: ['date_function', 'gameday', 'vacation'],
    condition: 'like_new',
    rent: 20,
    sale: 55,
    value: 95,
    description: 'Red gingham, square neck. Photographs beautifully.',
  },
  {
    name: 'Cropped Denim Jacket',
    brand: 'Zara',
    category: 'outerwear',
    size: 'M',
    shoeSize: null,
    occasions: ['date_function', 'gameday', 'going_out'],
    condition: 'good',
    rent: 12,
    sale: 35,
    value: 65,
    description: 'Throw over anything. Slightly oversized.',
  },

  // --- Vacation --------------------------------------------------------
  {
    name: 'Crochet Beach Set',
    brand: 'Free People',
    category: 'sets',
    size: 'XS',
    shoeSize: null,
    occasions: ['vacation'],
    condition: 'like_new',
    rent: 18,
    sale: 48,
    value: 90,
    description: 'Spring break staple. Top and shorts, lined.',
  },
  {
    name: 'Woven Straw Bag',
    brand: null,
    category: 'bags',
    size: null,
    shoeSize: null,
    occasions: ['vacation', 'going_out'],
    condition: 'good',
    rent: 8,
    sale: 25,
    value: 45,
    description: 'Roomy enough for a towel and sunscreen.',
  },
  {
    name: 'Tortoise Sunglasses',
    brand: null,
    category: 'accessories',
    size: null,
    shoeSize: null,
    occasions: ['vacation', 'gameday'],
    condition: 'good',
    rent: 6,
    sale: 18,
    value: 40,
    description: 'Oversized frames. Case included.',
  },

  // --- Graduation and jewellery ----------------------------------------
  {
    name: 'Gold Hoop Set',
    brand: null,
    category: 'jewelry',
    size: null,
    shoeSize: null,
    occasions: ['graduation', 'formal', 'going_out'],
    condition: 'like_new',
    rent: 5,
    sale: 20,
    value: 35,
    description: 'Three pairs, small to large. Gold plated, not real gold.',
  },
  {
    name: 'Pearl Drop Earrings',
    brand: null,
    category: 'jewelry',
    size: null,
    shoeSize: null,
    occasions: ['wedding', 'formal', 'graduation'],
    condition: 'new_with_tags',
    rent: 6,
    sale: 22,
    value: 40,
    description: 'Freshwater pearls. Never worn.',
  },
  {
    name: 'Cream Cropped Cardigan',
    brand: 'Aritzia',
    category: 'outerwear',
    size: 'L',
    shoeSize: null,
    occasions: ['graduation', 'rush'],
    condition: 'like_new',
    rent: 10,
    sale: 32,
    value: 60,
    description: 'Layer for a cold lecture hall or a chilly evening.',
  },
  {
    name: 'Black Wide Leg Trousers',
    brand: 'Aritzia',
    category: 'bottoms',
    size: 'XL',
    shoeSize: null,
    occasions: ['graduation', 'formal'],
    condition: 'like_new',
    rent: 15,
    sale: null,
    value: 110,
    description: 'Tailored, full length. Hemmed for about 5 foot 7 in flats.',
  },
  {
    name: 'Linen Button Down',
    brand: 'Zara',
    category: 'tops',
    size: 'M',
    shoeSize: null,
    occasions: ['vacation', 'rush', 'graduation'],
    condition: 'good',
    rent: 9,
    sale: 24,
    value: 45,
    description: 'Oversized, wears as a shirt or a cover-up.',
  },

  // --- Sale only, so the buy-without-renting path has real data --------
  {
    name: 'Polka Dot Mini Dress',
    brand: 'Urban Outfitters',
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    occasions: ['going_out', 'date_function'],
    condition: 'good',
    rent: null,
    sale: 32,
    value: 70,
    description: 'Selling, not renting — it no longer fits me. Great condition.',
  },
  {
    name: 'Suede Ankle Boots',
    brand: null,
    category: 'shoes',
    size: null,
    shoeSize: '9',
    occasions: ['going_out', 'gameday'],
    condition: 'well_loved',
    rent: null,
    sale: 45,
    value: 120,
    description: 'Selling these on. Scuff on the left toe, priced for it.',
  },
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
 * Seeded photos are real photographs, committed to the repo.
 *
 * They were flat colour blocks before that, and a 1x1 pixel before
 * THAT. Both made it impossible to tell whether the app looked right,
 * because on a phone a grey rectangle and a broken image are the same
 * thing. See seedPhotos.ts for why they are inlined rather than served
 * from the Storage emulator.
 */
let garmentCursor = 0;
let peopleCursor = 0;

/** A garment photo — what a listing shows. */
function image(path: string) {
  const uri = garmentPhoto(garmentCursor);
  garmentCursor += 1;
  return { path, url: uri, width: 600, height: 800, bytes: uri.length };
}

/** Someone wearing an outfit — what a look shows. */
/**
 * A lay-it-flat photo, which is what switches "Try it on" on.
 *
 * Given only to pieces in a try-on-eligible category, and only using
 * the four seed photos Phase 0 proved are clean — see seedPhotos. A
 * seeded flat photo that is actually a rail of clothes would make the
 * feature look broken while demonstrating exactly the failure the gate
 * exists to prevent.
 */
function flatImage(path: string, file: string) {
  const uri = demoGarment(file);
  return { path, url: uri, width: 760, height: 1013, bytes: uri.length };
}

function outfitImage(path: string) {
  const uri = peoplePhoto(peopleCursor);
  peopleCursor += 1;
  return { path, url: uri, width: 600, height: 800, bytes: uri.length };
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
  await db
    .collection(COLLECTIONS.campuses)
    .doc(CAMPUS_ID)
    .set({
      ...campus,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  console.warn('Created campus: University of South Carolina');

  await db.collection(COLLECTIONS.legalDocs).doc('terms_v1').set({
    id: 'terms_v1',
    kind: 'terms',
    title: 'Terms & Conditions',
    text: TERMS_V1,
    version: 1,
    effectiveDate: LEGAL_V1_EFFECTIVE_DATE,
    significantChange: false,
    publishedAt: FieldValue.serverTimestamp(),
    publishedByUid: 'seed',
    publishedByEmail: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.collection(COLLECTIONS.legalDocs).doc('privacy_v1').set({
    id: 'privacy_v1',
    kind: 'privacy',
    title: 'Privacy Policy',
    text: PRIVACY_V1,
    version: 1,
    effectiveDate: LEGAL_V1_EFFECTIVE_DATE,
    significantChange: false,
    publishedAt: FieldValue.serverTimestamp(),
    publishedByUid: 'seed',
    publishedByEmail: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.warn('Created legal docs: Terms v1, Privacy v1');

  /**
   * Looks for a body photo already in Storage for this uid.
   *
   * Returns the fields to merge into her tryOn block, or nothing. Any
   * failure — no bucket, no emulator storage, no permission — returns
   * nothing, because a seed that cannot read Storage must still seed.
   */
  async function existingBodyPhoto(uid: string) {
    try {
      const [files] = await getStorage()
        .bucket()
        .getFiles({ prefix: `users/${uid}/tryon/body/` });
      const newest = files.sort((a, b) => a.name.localeCompare(b.name)).pop();
      if (!newest) return {};
      console.warn(`Kept an existing body photo for ${uid}`);
      return {
        bodyPhotoPath: newest.name,
        bodyPhotoUploadedAt: FieldValue.serverTimestamp(),
        selfConfirmedAt: FieldValue.serverTimestamp(),
      };
    } catch {
      return {};
    }
  }

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
    console.warn(
      `Skipped ${ZACK_ADMIN_EMAIL}: SEED_ADMIN_PASSWORD is not set in backend/functions/.env.`,
    );
  }

  // --- Students -----------------------------------------------------------
  const users: User[] = [];

  for (const student of STUDENTS) {
    /*
      Zack's demo account, when its password is set locally.

      Skipped entirely when it is not: a seeded account with a
      guessable password and 50 try-ons is not something to create by
      accident, and this script will one day be pointed at a real
      project.
    */
    const demoPassword = student.demo
      ? process.env[student.demo.passwordEnv]?.trim()
      : undefined;
    if (student.demo && !demoPassword) {
      console.warn(
        `Skipped ${student.demo.email}: ${student.demo.passwordEnv} is not set in backend/functions/.env.`,
      );
      continue;
    }

    const email = student.demo?.email ?? `${student.username}@email.sc.edu`;
    const record = await auth.createUser({
      // A fixed uid for the demo account only, so its body photo in
      // Storage survives a reseed.
      ...(student.demo ? { uid: student.demo.uid } : {}),
      email,
      password: demoPassword ?? PASSWORD,
      displayName: student.first,
    });

    const user: User = {
      id: record.uid,
      uid: record.uid,
      username: student.username,
      firstName: student.first,
      displayName: student.first,
      bio: student.bio ?? 'usc • sharing my closet',
      photoUrl: peoplePhoto(users.length),
      campusId: CAMPUS_ID,
      isVerified: true,
      // Founding closets are verified by hand; everyone else by domain match.
      verificationMethod: student.founding ? 'manual_admin' : 'domain_claimed',
      verifiedAt: FieldValue.serverTimestamp() as never,
      // Nobody has proven inbox control — we do not email a code yet.
      emailConfirmed: false,
      emailConfirmedAt: null,
      // Half the seeded students show their sizes, half do not, so both
      // states are visible without editing a profile by hand.
      showSizes: users.length % 2 === 0,
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
      legalAccepted: {
        termsVersion: 1,
        termsAcceptedAt: FieldValue.serverTimestamp() as never,
        privacyVersion: 1,
        privacyAcceptedAt: FieldValue.serverTimestamp() as never,
      },
      stats: {
        followerCount: 0,
        followingCount: 0,
        listingCount: 0,
        postCount: 0,
        rentalsAsLender: 0,
        rentalsAsRenter: 0,
        ratingAverage: null,
        ratingCount: 0,
        cancellations: 0,
      },
      lastActiveAt: null,
      pushTokens: [],
      stripe: newUserStripe(),
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
        campusEmail: email,
        phone: null,
        handoffNotes: 'Usually around Russell House between classes.',
        profileChecklist: { dismissed: false, foundFriendsAt: null },
        walkthrough: newUserWalkthrough(),
        tryOn: {
          ...newUserTryOn(),
          ...(student.demo ? { bonusGranted: student.demo.bonusTryOns } : {}),
          /*
            His body photo, if one is already in Storage.

            The uid is fixed, so the FILE survives a reseed even though
            every Firestore document is rebuilt. Without this the photo
            would still be sitting there, orphaned, and he would be
            asked to take another one before every demo.
          */
          ...(student.demo ? await existingBodyPhoto(student.demo.uid) : {}),
        },
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

  /*
    The try-on switch.

    IT LIVES IN FIRESTORE, so it died with every emulator restart and
    every reseed — and try-on correctly defaults to OFF, which looked
    exactly like a broken feature. It was set once by hand and never
    written down anywhere a reseed would restore it.

    OFF, because try-on is not in v1. Zack's call, 2026-10-13.

    Both flags are false so it is hidden from admins too — "hide it
    completely" includes us, and an admin-only feature that nobody
    remembers is on is how a half-finished thing reaches a student.

    Turning it back on is one admin action. docs/decisions.md has the
    exact steps.
  */
  await db.collection(COLLECTIONS.config).doc('tryOn').set({
    enabled: false,
    enabledForAdmins: false,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: null,
  });
  console.warn('Try-on is OFF (v1). See docs/decisions.md to turn it on.');

  // --- Listings -----------------------------------------------------------
  const listings: Listing[] = [];

  // Deal the catalogue out across the closets, so founding closets are
  // fuller and every campus filter has something behind it.
  let cursor = 0;
  /*
    Fifteen demo garments spread evenly over the closets, so most
    students have two or three try-on-ready pieces and none has all of
    them.
  */
  let demoCursor = 0;
  const demoPerCloset = Math.ceil(DEMO_GARMENTS.length / users.length);
  for (const owner of users) {
    const catalogueCount = owner.isFoundingCloset ? 5 : 2;
    /*
      The demo garments are DEALT OUT across closets, not given to
      everyone. Fifteen identical wardrobes is not a campus, and the
      previous version of this put the same four pieces in every
      student's closet — which made the fitting room a rail of the same
      shirt from ten different people.
    */
    const items = [
      ...Array.from({ length: catalogueCount }, () => CATALOGUE[cursor++ % CATALOGUE.length]!),
      ...Array.from({ length: demoPerCloset }, () =>
        demoCursor < DEMO_GARMENTS.length ? DEMO_GARMENTS[demoCursor++]! : null,
      ).filter((x): x is SeedItem => x !== null),
    ];
    const count = items.length;

    for (let i = 0; i < count; i += 1) {
      const item = items[i]!;

      const ref = db.collection(COLLECTIONS.listings).doc();
      /*
        A demo garment is its OWN listing photo as well as its flat
        photo — the same file, so the card and the try-on can never
        show different garments. Everything else keeps the stock
        photos.
      */
      const photos = [
        item.flatFile
          ? flatImage(`users/${owner.uid}/listings/${ref.id}/1.jpg`, item.flatFile)
          : image(`users/${owner.uid}/listings/${ref.id}/1.jpg`),
      ];
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
        // ONLY when this catalogue entry describes that exact photo.
        // A flat photo is the garment the try-on renders, so borrowing
        // one from another piece renders the wrong garment convincingly.
        /*
          A third of closets offer same day, so the filter and the
          badge both have something behind them without every piece
          claiming a promise its owner may not keep.
        */
        sameDay: { enabled: random() > 0.66, premiumBps: null },
        flatPhoto: item.flatFile
          ? flatImage(`users/${owner.uid}/listings/${ref.id}/flat.jpg`, item.flatFile)
          : null,
        brand: item.brand,
        category: item.category,
        size: item.size,
        shoeSize: item.shoeSize,
        condition: item.condition,
        occasions: item.occasions,
        colorNames: [],
        photos,
        coverUrl: photos[0]!.url,
        intent,
        status: 'active',
        pricing: {
          // An overnight is cheaper than three days but not a third of
          // it — the lender still loses the piece for a weekend either
          // way. 0.7x is the usual shape.
          oneDayCents: item.rent != null ? Math.round(item.rent * 0.7) * 100 : null,
          threeDayCents: item.rent != null ? item.rent * 100 : null,
          // A week is worth more than two three-day rentals to a lender,
          // but less than double to a renter. 1.6x is the usual shape.
          sevenDayCents: item.rent != null ? Math.round(item.rent * 1.6) * 100 : null,
        },
        // Roughly a third of closets charge for cleaning, so the seed
        // has both kinds to look at.
        cleaningFeeCents: item.rent != null && cursor % 3 === 0 ? 800 : null,
        salePriceCents: item.sale != null ? item.sale * 100 : null,
        garmentValueCents: item.value * 100,
        // MVP: every request needs the lender's approval.
        requiresApproval: true,
        blackoutDates: [],
        // Recomputed by syncListingAvailability as bookings are seeded.
        bookedDates: [],
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
  // Posts carry REAL tags, pinned to plausible spots on the photo, so the
  // feed exercises the whole tap-photo -> tap-dot -> open-listing path and
  // "Seen in posts" on a listing has something to show.
  let postCount = 0;
  let tagTotal = 0;
  const tagCounts = new Map<string, number>();

  /**
   * Where a tag sits, as a fraction of the photo. Roughly where the
   * garment would be in a full-length outfit shot.
   */
  const SPOTS: Record<Category, { x: number; y: number }> = {
    dresses: { x: 0.5, y: 0.52 },
    tops: { x: 0.5, y: 0.34 },
    bottoms: { x: 0.5, y: 0.66 },
    sets: { x: 0.5, y: 0.5 },
    outerwear: { x: 0.34, y: 0.4 },
    shoes: { x: 0.5, y: 0.9 },
    bags: { x: 0.74, y: 0.58 },
    accessories: { x: 0.58, y: 0.2 },
    jewelry: { x: 0.46, y: 0.24 },
  };

  for (const author of users) {
    const count = author.isFoundingCloset ? 3 : 1;
    const theirListings = listings.filter((l) => l.ownerUid === author.uid);

    for (let i = 0; i < count; i += 1) {
      const ref = db.collection(COLLECTIONS.posts).doc();

      // Most looks tag something; a few are just outfit photos, which is
      // how a real feed looks.
      /*
        Try-on-ready pieces are tagged FIRST when she owns one.

        A student posting a look tags the piece she is lending, and the
        pieces worth lending are the ones with a proper photo. Without
        this bias the seed tagged whatever the catalogue happened to
        deal her, and not one post in nineteen could offer "Try this
        look on" — the feature existed and was invisible.
      */
      const theirs = [
        ...theirListings.filter((l) => isTryOnReady(l)),
        ...theirListings.filter((l) => !isTryOnReady(l)),
      ];

      /*
        A TAG MUST MATCH THE PHOTO IT IS ON.

        It never did. The post photo was a stock shot of somebody in an
        outfit and the tag was whatever the author happened to own, so
        a graphic t-shirt came up labelled "White Eyelet Two-Piece ·
        $28" — which is the exact failure the flat-photo gate exists to
        prevent, printed on the feed instead.

        So a tagged post now USES THE PIECE'S OWN PHOTO. If we cannot
        show the garment, we do not claim it is in the picture.

        ONE TAG, for the same reason: the photo can only honestly be
        one garment. That costs the seed its multi-tag coverage, and a
        label that lies costs more.
      */
      const tagged: Listing[] = [];
      const taggable = theirs.filter((l) => l.flatPhoto);
      if (taggable.length > 0 && random() > 0.2) {
        tagged.push(taggable[i % taggable.length]!);
      }

      const tags = tagged.map((listing) => {
        const spot = SPOTS[listing.category];
        tagCounts.set(listing.id, (tagCounts.get(listing.id) ?? 0) + 1);
        tagTotal += 1;
        return {
          // Nudge each tag slightly so two never sit exactly on top of
          // each other.
          x: Math.min(0.92, Math.max(0.08, spot.x + (random() - 0.5) * 0.12)),
          y: Math.min(0.92, Math.max(0.08, spot.y + (random() - 0.5) * 0.08)),
          listingId: listing.id,
          ownerUid: listing.ownerUid,
          label: {
            name: listing.name,
            coverUrl: listing.coverUrl,
            priceCents3Day: listing.pricing.threeDayCents,
            salePriceCents: listing.salePriceCents,
            ownerUsername: listing.owner.username,
            tryOnReady: isTryOnReady(listing),
          },
        };
      });

      const post: Post = {
        id: ref.id,
        campusId: CAMPUS_ID,
        authorUid: author.uid,
        author: summaryOf(author),
        /*
          The tagged piece's own image when there is a tag, so the
          label describes what is actually in the frame. An untagged
          look is just an outfit photo and keeps a stock shot.
        */
        photos: [
          tagged[0]
            ? {
                ...tagged[0].flatPhoto!,
                path: `users/${author.uid}/posts/${ref.id}/1.jpg`,
                tags,
              }
            : { ...outfitImage(`users/${author.uid}/posts/${ref.id}/1.jpg`), tags },
        ],
        caption: pick(CAPTIONS),
        // A look inherits the occasion of what it features, which is how
        // someone would actually tag it.
        occasions:
          tagged.length > 0
            ? (tagged[0]!.occasions.slice(0, 2) as Occasion[])
            : (pickSome(OCCASIONS, 2) as Occasion[]),
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
        createdAt: FieldValue.serverTimestamp() as never,
        updatedAt: FieldValue.serverTimestamp() as never,
      };

      await ref.set(post);
      postCount += 1;
    }

    await db.collection(COLLECTIONS.users).doc(author.uid).update({ 'stats.postCount': count });
  }

  // Keep each listing's tagCount honest, the way createPost would have.
  for (const [listingId, n] of tagCounts) {
    await db.collection(COLLECTIONS.listings).doc(listingId).update({ 'stats.tagCount': n });
  }
  console.warn(`Tagged ${tagTotal} pieces across ${tagCounts.size} listings`);
  console.warn(`Created ${postCount} posts`);

  // --- Bookings, one in every status ---------------------------------------
  // So every screen has something real: a request waiting on the lender,
  // one in flight, one just back with the dispute window open, and the
  // terminal ones that fill the Past list.
  const bookingPlans: {
    status: Booking['status'];
    /** Days from today the rental starts. Negative is in the past. */
    startsIn: number;
    days: 3 | 7;
    note?: string;
  }[] = [
    { status: 'requested', startsIn: 9, days: 3, note: 'Is this free for the Georgia game?' },
    { status: 'confirmed', startsIn: 4, days: 3 },
    { status: 'with_renter', startsIn: -1, days: 3 },
    { status: 'returned', startsIn: -5, days: 3 },
    { status: 'completed', startsIn: -20, days: 7 },
    { status: 'declined', startsIn: 12, days: 3 },
    { status: 'cancelled', startsIn: 15, days: 3 },
    { status: 'disputed', startsIn: -12, days: 3 },
  ];

  const rentable = listings.filter((l) => l.pricing.threeDayCents != null);
  let bookingCount = 0;

  for (const [index, plan] of bookingPlans.entries()) {
    const listing = rentable[index % rentable.length]!;
    // Anyone but the owner.
    const renter = users.find((u) => u.uid !== listing.ownerUid)!;
    const lender = users.find((u) => u.uid === listing.ownerUid)!;

    const start = new Date();
    start.setUTCDate(start.getUTCDate() + plan.startsIn);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = addDays(startDate, plan.days);

    const baseCents = priceForDuration(listing.pricing, plan.days) ?? 2500;
    const amounts = calculateFees({
      baseCents,
      garmentValueCents: listing.garmentValueCents,
      cleaningFeeCents: listing.cleaningFeeCents ?? 0,
    });

    const ref = db.collection(COLLECTIONS.bookings).doc();
    const handedOver = ['with_renter', 'returned', 'completed', 'disputed'].includes(plan.status);
    const backAgain = ['returned', 'completed', 'disputed'].includes(plan.status);

    const booking: Booking = {
      id: ref.id,
      kind: 'rental',
      status: plan.status,
      campusId: CAMPUS_ID,
      listingId: listing.id,
      listing: {
        listingId: listing.id,
        name: listing.name,
        coverUrl: listing.coverUrl,
        ownerUid: listing.ownerUid,
        priceCents3Day: listing.pricing.threeDayCents,
        salePriceCents: listing.salePriceCents,
      },
      lenderUid: lender.uid,
      lender: summaryOf(lender),
      renterUid: renter.uid,
      renter: summaryOf(renter),
      startDate,
      endDate,
      durationDays: plan.days,
      amounts,
      payment: newBookingPayment(),
      renterMessage: plan.note ?? null,
      handoff: {
        notes: 'Meet outside Russell House.',
        dropoffPhotos: handedOver ? [image(`users/${lender.uid}/bookings/${ref.id}/drop.jpg`)] : [],
        dropoffAt: handedOver ? (FieldValue.serverTimestamp() as never) : null,
        renterConfirmedReceiptAt: handedOver ? (FieldValue.serverTimestamp() as never) : null,
        returnPhotos: backAgain ? [image(`users/${lender.uid}/bookings/${ref.id}/back.jpg`)] : [],
        renterConfirmedReturnAt: backAgain ? (FieldValue.serverTimestamp() as never) : null,
        lenderConfirmedReturnAt: backAgain ? (FieldValue.serverTimestamp() as never) : null,
      },
      timeline: {
        requestedAt: FieldValue.serverTimestamp() as never,
        respondedAt: plan.status === 'requested' ? null : (FieldValue.serverTimestamp() as never),
        confirmedAt:
          handedOver || plan.status === 'confirmed'
            ? (FieldValue.serverTimestamp() as never)
            : null,
        cancelledAt: plan.status === 'cancelled' ? (FieldValue.serverTimestamp() as never) : null,
        completedAt: plan.status === 'completed' ? (FieldValue.serverTimestamp() as never) : null,
      },
      cancelledByUid: plan.status === 'cancelled' ? renter.uid : null,
      cancellationReason: plan.status === 'cancelled' ? 'My plans changed' : null,
      declineReason: plan.status === 'declined' ? 'Already promised to a friend' : null,
      // Only a live request has a deadline to answer by.
      expiresAt:
        plan.status === 'requested'
          ? (Timestamp.fromDate(new Date(Date.now() + 36 * 3600_000)) as never)
          : null,
      // Only a fresh return is inside its window.
      disputeWindowEndsAt:
        plan.status === 'returned'
          ? (Timestamp.fromDate(new Date(Date.now() + 30 * 3600_000)) as never)
          : null,
      returnProblem:
        plan.status === 'disputed'
          ? {
              type: 'damaged',
              note: 'Small tear on the left strap.',
              photos: [image(`users/${lender.uid}/bookings/${ref.id}/problem.jpg`)],
              flaggedAt: FieldValue.serverTimestamp() as never,
            }
          : null,
      disputeResolution: null,
      activeClaimId: null,
      reviews: { lenderReviewId: null, renterReviewId: null },
      createdAt: FieldValue.serverTimestamp() as never,
      updatedAt: FieldValue.serverTimestamp() as never,
    };

    await ref.set(booking);
    bookingCount += 1;

    // A completed rental counts towards both their histories.
    if (plan.status === 'completed') {
      await db
        .collection(COLLECTIONS.users)
        .doc(lender.uid)
        .update({ 'stats.rentalsAsLender': FieldValue.increment(1) });
      await db
        .collection(COLLECTIONS.users)
        .doc(renter.uid)
        .update({ 'stats.rentalsAsRenter': FieldValue.increment(1) });
      await db
        .collection(COLLECTIONS.listings)
        .doc(listing.id)
        .update({ 'stats.completedRentals': FieldValue.increment(1) });
    }
  }

  await db
    .collection(COLLECTIONS.campuses)
    .doc(CAMPUS_ID)
    .update({ 'stats.bookingCount': bookingCount });
  console.warn(`Created ${bookingCount} bookings, one in every status`);

  // --- Follows, likes, saves ---------------------------------------------
  const allPosts = await db.collection(COLLECTIONS.posts).get();
  let followCount = 0;
  let likeCount = 0;
  let postSaveCount = 0;

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
      // likePost stamps the liker on the post so the feed can say
      // "Liked by Harper" without a query. The seed has to do the same
      // or every post shows a bare count.
      await doc.ref.update({
        'stats.likeCount': FieldValue.increment(1),
        lastLiker: summaryOf(follower),
      });
      likeCount += 1;
    }


    /*
      Saved LOOKS, not just saved pieces.

      The fitting room draws from both — a dress she starred on
      somebody's gameday post is a dress she is interested in. Without
      saved posts in the seed that whole second source is untestable,
      and it silently looked like it worked because the first source
      filled the row.

      Only posts that actually tag something: a saved post with no
      tagged pieces contributes nothing and proves nothing.
    */
    const taggedFromSavedLooks = new Set<string>();
    for (const doc of allPosts.docs) {
      const post = doc.data() as Post;
      if (post.authorUid === follower.uid) continue;
      if ((post.taggedListingIds ?? []).length === 0) continue;
      if (random() > 0.3) continue;

      const id = ids.postSave(follower.uid, post.id);
      await db.collection(COLLECTIONS.postSaves).doc(id).set({
        id,
        uid: follower.uid,
        postId: post.id,
        postAuthorUid: post.authorUid,
        campusId: CAMPUS_ID,
        createdAt: FieldValue.serverTimestamp(),
      });
      postSaveCount += 1;
      for (const id of post.taggedListingIds ?? []) taggedFromSavedLooks.add(id);
    }

    /*
      Saves, with a deliberate thumb on the scale.

      A purely random 15% left Ella with six saved pieces of which five
      were sets, shoes and trousers — categories try-on cannot do at
      all — so the fitting room had two things in it and the feature
      looked thinner than it is. The catalogue is simply heavier on
      accessories than on dresses.

      So: the random saves as before, plus a guaranteed handful of
      try-on-eligible pieces. This is seed data existing to be tested
      with, not a model of what a real student saves.
    */
    const savedHere = new Set<string>();
    /*
      Try-on pieces are deduped BY NAME, not by id.

      Every student is given the same four, so saving by id alone put
      ten Chambray Button Downs in one rail — the same shirt from ten
      closets, which reads as broken rather than full. Ordinary
      listings are unaffected: two students really can own different
      black slip dresses.
    */
    const savedGarments = new Set<string>();
    const saveListing = async (listing: Listing) => {
      if (savedHere.has(listing.id)) return;
      if (listing.flatPhoto) {
        if (savedGarments.has(listing.name)) return;
        savedGarments.add(listing.name);
      }
      savedHere.add(listing.id);
      const id = ids.save(follower.uid, listing.id);
      await db.collection(COLLECTIONS.saves).doc(id).set({
        id,
        uid: follower.uid,
        listingId: listing.id,
        campusId: CAMPUS_ID,
        createdAt: FieldValue.serverTimestamp(),
      });
    };

    for (const listing of listings) {
      if (listing.ownerUid === follower.uid || random() > 0.15) continue;
      await saveListing(listing);
    }

    /*
      Skipping anything already reachable through a saved look, so at
      least one piece in the fitting room arrives ONLY from a look.
      Otherwise the guaranteed saves swallow that second source and it
      becomes untestable again — which is the exact failure this seed
      change was meant to fix.
    */
    const tryable = listings.filter(
      (l) =>
        l.ownerUid !== follower.uid &&
        l.flatPhoto != null &&
        !taggedFromSavedLooks.has(l.id) &&
        (TRYON_CATEGORY_MAP as Record<string, string | undefined>)[l.category],
    );
    /*
      The demo account saves EVERY tryable piece, not a handful.

      A demo where the fitting room happens to be thin is a demo that
      goes wrong in front of somebody. Everyone else gets the usual
      sample.
    */
    /*
      The demo account saves every DISTINCT tryable garment; everyone
      else gets a sample. saveListing does the deduping.
    */
    const isDemo = Boolean(STUDENTS.find((st) => st.username === follower.username)?.demo);
    if (isDemo) {
      /*
        The demo account saves EVERY demo garment, bottoms included.
        Bottoms are not tryable yet, so they appear greyed in the
        fitting room — which is the state worth being able to show
        rather than hide.
      */
      // Including the two he owns himself. Saving your own piece is
      // odd in real life and exactly right for a demo: all fifteen in
      // one place, nothing missing mid-sentence.
      for (const listing of listings.filter((l) => l.flatPhoto)) {
        await saveListing(listing);
      }
    } else {
      for (const listing of tryable.slice(0, TRYABLE_SAVES_PER_USER)) {
        await saveListing(listing);
      }
    }

  }
  console.warn(
    `Created ${followCount} follows, ${likeCount} likes and ${postSaveCount} saved looks`,
  );

  // --- Chats, reviews and reports -----------------------------------------
  // So the inbox, the Reviews tab and the admin queue all have something
  // real in them rather than three empty states.
  let chatCount = 0;
  let messageCount = 0;

  const OPENERS = [
    ['Is this still free for formals weekend?', 'Yes! It is all yours.'],
    ['Would this fit a 5\'6" frame?', 'Should do — it is a little long on me and I am 5\'4".'],
    ['Could I collect from Russell House around 4?', 'Perfect, see you then.'],
  ];

  for (const [index, opener] of OPENERS.entries()) {
    const a = users[index]!;
    const b = users[(index + 3) % users.length]!;
    if (a.uid === b.uid) continue;

    const conversationId = ids.conversation(a.uid, b.uid);
    const ref = db.collection(COLLECTIONS.conversations).doc(conversationId);

    await ref.set({
      id: conversationId,
      campusId: CAMPUS_ID,
      participantUids: [a.uid, b.uid].sort(),
      participants: { [a.uid]: summaryOf(a), [b.uid]: summaryOf(b) },
      listingId: null,
      bookingId: null,
      lastMessage: { body: opener[1]!, senderUid: b.uid, sentAt: FieldValue.serverTimestamp() },
      // One unread for the person who asked, so the badge is visible.
      unreadCounts: { [a.uid]: 1, [b.uid]: 0 },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    for (const [i, body] of opener.entries()) {
      await ref.collection('messages').add({
        conversationId,
        senderUid: i === 0 ? a.uid : b.uid,
        body,
        photo: null,
        sharedPost: null,
        readBy: [i === 0 ? a.uid : b.uid],
        isDeleted: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      messageCount += 1;
    }
    chatCount += 1;
  }
  console.warn(`Created ${chatCount} chats with ${messageCount} messages`);

  // --- Comments -----------------------------------------------------------
  // A look with no comments under it tells you nothing about whether the
  // comment row works, so a third of them get one or two.
  const COMMENTS = [
    'obsessed with this',
    'where is the top from??',
    'you wore this so well',
    'need this for gameday',
    'the shoes are everything',
    'is the dress still available?',
  ];

  let commentCount = 0;
  for (const doc of allPosts.docs) {
    const post = doc.data() as Post;
    if (random() > 0.35) continue;

    const howMany = random() > 0.6 ? 2 : 1;
    let added = 0;
    for (let i = 0; i < howMany; i += 1) {
      const author = pick(users);
      // Talking to yourself under your own look is not a comment.
      if (author.uid === post.authorUid) continue;

      const ref = db.collection(COLLECTIONS.comments).doc();
      await ref.set({
        id: ref.id,
        campusId: CAMPUS_ID,
        postId: post.id,
        authorUid: author.uid,
        author: summaryOf(author),
        body: pick(COMMENTS),
        parentCommentId: null,
        status: 'active',
        suspendedReason: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      added += 1;
      commentCount += 1;
    }
    if (added > 0) {
      await doc.ref.update({ 'stats.commentCount': FieldValue.increment(added) });
    }
  }
  console.warn(`Created ${commentCount} comments`);

  // --- One shared look ----------------------------------------------------
  // So the chat screen has a post-preview bubble in it and the share
  // count on a post is not zero everywhere.
  const sharedSource = allPosts.docs[0];
  if (sharedSource && chatCount > 0) {
    const post = sharedSource.data() as Post;
    const a = users[0]!;
    const b = users[3 % users.length]!;
    if (a.uid !== b.uid) {
      const conversationId = ids.conversation(a.uid, b.uid);
      await db
        .collection(COLLECTIONS.conversations)
        .doc(conversationId)
        .collection('messages')
        .add({
          conversationId,
          senderUid: a.uid,
          body: 'this is the one I meant',
          photo: null,
          sharedPost: {
            postId: post.id,
            photoUrl: post.photos[0]?.url ?? null,
            caption: (post.caption ?? '').slice(0, 140),
            authorUsername: post.author.username,
          },
          readBy: [a.uid],
          isDeleted: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      await sharedSource.ref.update({ 'stats.shareCount': FieldValue.increment(1) });
      console.warn('Created 1 shared look in a chat');
    }
  }

  // Reviews on the completed rental, both directions.
  const completed = (
    await db.collection(COLLECTIONS.bookings).where('status', '==', 'completed').get()
  ).docs;

  let reviewCount = 0;
  for (const doc of completed) {
    const booking = doc.data() as Booking;
    const pairs: {
      author: User;
      subject: string;
      role: 'lender' | 'renter';
      rating: number;
      body: string;
    }[] = [
      {
        author: users.find((u) => u.uid === booking.lenderUid)!,
        subject: booking.renterUid,
        role: 'lender',
        rating: 5,
        body: 'Returned it spotless and right on time. Would lend to her again.',
      },
      {
        author: users.find((u) => u.uid === booking.renterUid)!,
        subject: booking.lenderUid,
        role: 'renter',
        rating: 5,
        body: 'Exactly as described and so easy to meet up with.',
      },
    ];

    for (const p of pairs) {
      if (!p.author) continue;
      const reviewRef = db.collection(COLLECTIONS.reviews).doc();
      await reviewRef.set({
        id: reviewRef.id,
        campusId: CAMPUS_ID,
        bookingId: doc.id,
        listingId: booking.listingId,
        authorUid: p.author.uid,
        author: summaryOf(p.author),
        subjectUid: p.subject,
        authorRole: p.role,
        rating: p.rating,
        body: p.body,
        isHidden: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db
        .collection(COLLECTIONS.users)
        .doc(p.subject)
        .update({
          'stats.ratingCount': FieldValue.increment(1),
          'stats.ratingAverage': p.rating,
        });
      await doc.ref.update({
        [p.role === 'lender' ? 'reviews.lenderReviewId' : 'reviews.renterReviewId']: reviewRef.id,
      });
      reviewCount += 1;
    }
  }
  console.warn(`Created ${reviewCount} reviews`);

  // A couple of open reports so the admin queue is not empty.
  const reportSeeds: { targetType: string; reason: string; details: string }[] = [
    {
      targetType: 'listing',
      reason: 'not_as_described',
      details: 'The photos look like a different colour to what turned up.',
    },
    {
      targetType: 'user',
      reason: 'off_platform_payment',
      details: 'Asked me to Venmo her before confirming anything.',
    },
  ];

  for (const [index, seedReport] of reportSeeds.entries()) {
    const reporter = users[index]!;
    const target = users[(index + 5) % users.length]!;
    const listing = listings.find((l) => l.ownerUid === target.uid);
    const ref = db.collection(COLLECTIONS.reports).doc();
    await ref.set({
      id: ref.id,
      campusId: CAMPUS_ID,
      reporterUid: reporter.uid,
      targetType: seedReport.targetType,
      targetId: seedReport.targetType === 'listing' ? (listing?.id ?? target.uid) : target.uid,
      targetUid: target.uid,
      reason: seedReport.reason,
      details: seedReport.details,
      photos: [],
      status: 'open',
      resolution: { adminUid: null, action: null, notes: null, resolvedAt: null },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  console.warn(`Created ${reportSeeds.length} open reports`);

  // A few audit rows and a note, so the Activity Log and the user
  // detail page have something real in them.
  const adminUid = adminRecord.uid;
  const auditSeeds = [
    {
      action: 'hide_listing',
      targetType: 'listing',
      targetId: listings[0]!.id,
      notes: 'Photos did not match the description. Asked her to relist with real ones.',
    },
    {
      action: 'report_dismissed',
      targetType: 'report',
      targetId: 'seeded-report',
      notes: 'Checked the thread — a misunderstanding about pickup time, not a scam.',
    },
  ];

  for (const row of auditSeeds) {
    const ref = db.collection(COLLECTIONS.adminActions).doc();
    await ref.set({
      id: ref.id,
      adminUid,
      adminEmail: 'admin@joinloane.com',
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      notes: row.notes,
      before: null,
      after: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const notedUser = users[4]!;
  const noteRef = db
    .collection(COLLECTIONS.users)
    .doc(notedUser.uid)
    .collection('adminNotes')
    .doc();
  await noteRef.set({
    id: noteRef.id,
    uid: notedUser.uid,
    note: 'Asked a renter to pay off-platform once. Warned, seemed to take it on board.',
    adminUid,
    adminEmail: 'admin@joinloane.com',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.warn(`Created ${auditSeeds.length} audit rows and 1 admin note`);

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
