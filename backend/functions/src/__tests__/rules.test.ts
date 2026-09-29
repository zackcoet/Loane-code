/**
 * Security rules tests.
 *
 * These assert the things that must be impossible. They are the difference
 * between "we wrote rules" and "the rules work".
 *
 * Run the emulators first:  npm run emulators
 * Then:                     npm test --workspace @loane/functions
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { EVENT_SURFACES, EVENT_TYPES } from '@loane/shared';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const ELLA = 'uid-ella';
const MADDIE = 'uid-maddie';
const ADMIN = 'uid-admin';
const CAMPUS = 'university-of-south-carolina';

let testEnv: RulesTestEnvironment;

/** A minimal but valid user profile. */
function userDoc(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    id: uid,
    uid,
    username: uid,
    firstName: 'Test',
    displayName: 'Test',
    bio: '',
    photoUrl: null,
    campusId: CAMPUS,
    isVerified: true,
    verificationMethod: 'domain_claimed',
    verifiedAt: new Date(),
    emailConfirmed: false,
    emailConfirmedAt: null,
    sizes: { tops: null, bottoms: null, dresses: null, shoe: null },
    role: 'student',
    status: 'active',
    suspendedReason: null,
    suspendedUntil: null,
    isFoundingCloset: false,
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function listingDoc(ownerUid: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing-1',
    campusId: CAMPUS,
    ownerUid,
    owner: {
      uid: ownerUid,
      username: ownerUid,
      displayName: 'Test',
      photoUrl: null,
      campusId: CAMPUS,
      isVerified: true,
    },
    name: 'Vintage Silk Slip Dress',
    description: '',
    brand: null,
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    condition: 'like_new',
    occasions: ['formal'],
    colorNames: [],
    photos: [
      { path: `users/${ownerUid}/listings/listing-1/1.jpg`, url: 'https://example.test/1.jpg', width: 1200, height: 1600 },
    ],
    coverUrl: 'https://example.test/1.jpg',
    intent: 'rent',
    status: 'active',
    pricing: { threeDayCents: 2500, sevenDayCents: 4000 },
    salePriceCents: null,
    garmentValueCents: 12000,
    requiresApproval: true,
    blackoutDates: [],
    stats: { viewCount: 0, saveCount: 0, tagCount: 0, completedRentals: 0 },
    suspendedReason: null,
    removedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-loane-rules',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed profiles with rules bypassed, the way a Cloud Function would.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ELLA), userDoc(ELLA));
    await setDoc(doc(db, 'users', MADDIE), userDoc(MADDIE));
    await setDoc(doc(db, 'users', ADMIN), userDoc(ADMIN, { role: 'admin' }));
    await setDoc(doc(db, 'listings', 'listing-1'), listingDoc(ELLA));
  });
});

const asElla = () => testEnv.authenticatedContext(ELLA).firestore();
const asMaddie = () => testEnv.authenticatedContext(MADDIE).firestore();
const asAdmin = () => testEnv.authenticatedContext(ADMIN, { admin: true }).firestore();
const asStranger = () => testEnv.unauthenticatedContext().firestore();

describe('users', () => {
  it('lets her edit her own bio', async () => {
    await assertSucceeds(updateDoc(doc(asElla(), 'users', ELLA), { bio: 'usc • sharing my closet' }));
  });

  it('stops her editing someone else’s profile', async () => {
    await assertFails(updateDoc(doc(asMaddie(), 'users', ELLA), { bio: 'hacked' }));
  });

  it('stops her inventing her own follower count', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'users', ELLA), { 'stats.followerCount': 10_000 }),
    );
  });

  it('stops her marking herself verified', async () => {
    // Start unverified, so this is a real change rather than a no-op write.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA), userDoc(ELLA, { isVerified: false }));
    });
    await assertFails(updateDoc(doc(asElla(), 'users', ELLA), { isVerified: true }));
  });

  it('stops her making herself an admin', async () => {
    await assertFails(updateDoc(doc(asElla(), 'users', ELLA), { role: 'admin' }));
  });

  it('stops her moving to another campus', async () => {
    await assertFails(updateDoc(doc(asElla(), 'users', ELLA), { campusId: 'some-other-school' }));
  });

  it('stops a signed-out visitor reading profiles', async () => {
    await assertFails(getDoc(doc(asStranger(), 'users', ELLA)));
  });

  // --- Phase 1: the fields a profile edit must never reach --------------

  it('lets her edit the fields the Edit Profile screen owns', async () => {
    await assertSucceeds(
      updateDoc(doc(asElla(), 'users', ELLA), {
        displayName: 'Ella P',
        bio: 'gameday and formals',
        photoUrl: 'https://example.test/photo.jpg',
        sizes: { tops: 'S', bottoms: 'S', dresses: 'S', shoe: '7.5' },
      }),
    );
  });

  it('stops her changing her own username (only changeUsername may)', async () => {
    await assertFails(updateDoc(doc(asElla(), 'users', ELLA), { username: 'someoneelse' }));
  });

  it('stops her changing her campus email', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'users', ELLA), { campusId: 'harvard' }),
    );
  });

  it('stops her confirming her own email', async () => {
    await assertFails(updateDoc(doc(asElla(), 'users', ELLA), { emailConfirmed: true }));
  });

  it('stops her un-suspending her own account', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA), userDoc(ELLA, { status: 'suspended' }));
    });
    await assertFails(updateDoc(doc(asElla(), 'users', ELLA), { status: 'active' }));
  });

  it('stops her flagging herself as a founding closet', async () => {
    await assertFails(updateDoc(doc(asElla(), 'users', ELLA), { isFoundingCloset: true }));
  });

  it('stops her editing a real field and a forbidden one in the same write', async () => {
    // A single write touching both must fail as a whole — otherwise the
    // allow-list could be slipped past by bundling.
    await assertFails(
      updateDoc(doc(asElla(), 'users', ELLA), {
        bio: 'looks innocent',
        'stats.followerCount': 9999,
      }),
    );
  });
});

describe('private settings', () => {
  it('stops another student reading her contact details', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA, 'private', 'settings'), {
        uid: ELLA,
        accountEmail: 'ella@email.sc.edu',
        phone: '555-0100',
      });
    });
    await assertFails(getDoc(doc(asMaddie(), 'users', ELLA, 'private', 'settings')));
    await assertSucceeds(getDoc(doc(asElla(), 'users', ELLA, 'private', 'settings')));
  });
});

describe('listings', () => {
  it('lets her create a listing in her own closet', async () => {
    await assertSucceeds(
      setDoc(doc(asElla(), 'listings', 'listing-new'), listingDoc(ELLA, { id: 'listing-new' })),
    );
  });

  it('lets her create one with "Available now" off', async () => {
    // The form writes status 'paused' when that toggle is off. create
    // used to allow only draft and active, so turning it off meant the
    // listing was refused — and the app blamed her connection for it.
    await assertSucceeds(
      setDoc(
        doc(asElla(), 'listings', 'listing-paused'),
        listingDoc(ELLA, { id: 'listing-paused', status: 'paused' }),
      ),
    );
  });

  it('still refuses a status the app never writes', async () => {
    for (const status of ['sold', 'suspended', 'removed']) {
      await assertFails(
        setDoc(
          doc(asElla(), 'listings', `listing-${status}`),
          listingDoc(ELLA, { id: `listing-${status}`, status }),
        ),
      );
    }
  });

  it('stops her creating a listing owned by someone else', async () => {
    await assertFails(
      setDoc(doc(asMaddie(), 'listings', 'listing-fake'), listingDoc(ELLA, { id: 'listing-fake' })),
    );
  });

  it('stops a new listing starting with a fake view count', async () => {
    await assertFails(
      setDoc(
        doc(asElla(), 'listings', 'listing-inflated'),
        listingDoc(ELLA, {
          id: 'listing-inflated',
          stats: { viewCount: 9999, saveCount: 0, tagCount: 0, completedRentals: 0 },
        }),
      ),
    );
  });

  it('stops another student editing her listing', async () => {
    await assertFails(updateDoc(doc(asMaddie(), 'listings', 'listing-1'), { name: 'Mine now' }));
  });

  it('stops her hard-deleting a listing (history has to survive)', async () => {
    await assertFails(deleteDoc(doc(asElla(), 'listings', 'listing-1')));
  });

  // --- Phase 2: the listing rules mirror validateListingDraft ----------

  it('refuses a listing with no photos', async () => {
    await assertFails(
      setDoc(
        doc(asElla(), 'listings', 'listing-nophoto'),
        listingDoc(ELLA, { id: 'listing-nophoto', photos: [], coverUrl: null }),
      ),
    );
  });

  it('refuses a listing with no occasions — nobody could ever find it', async () => {
    await assertFails(
      setDoc(
        doc(asElla(), 'listings', 'listing-noocc'),
        listingDoc(ELLA, { id: 'listing-noocc', occasions: [] }),
      ),
    );
  });

  it('refuses a rentable listing with no price', async () => {
    await assertFails(
      setDoc(
        doc(asElla(), 'listings', 'listing-free'),
        listingDoc(ELLA, {
          id: 'listing-free',
          pricing: { threeDayCents: null, sevenDayCents: null },
        }),
      ),
    );
  });

  it('refuses a rentable listing with no documented garment value', async () => {
    // The value is what caps a damage claim later, so a rentable piece
    // without one has no protection behind it.
    await assertFails(
      setDoc(
        doc(asElla(), 'listings', 'listing-novalue'),
        listingDoc(ELLA, { id: 'listing-novalue', garmentValueCents: 0 }),
      ),
    );
  });

  it('refuses a price that is not whole cents', async () => {
    await assertFails(
      setDoc(
        doc(asElla(), 'listings', 'listing-float'),
        listingDoc(ELLA, {
          id: 'listing-float',
          pricing: { threeDayCents: 25.5, sevenDayCents: 4000 },
        }),
      ),
    );
  });

  it('refuses a for-sale listing with no sale price', async () => {
    await assertFails(
      setDoc(
        doc(asElla(), 'listings', 'listing-nosale'),
        listingDoc(ELLA, { id: 'listing-nosale', intent: 'sell', salePriceCents: null }),
      ),
    );
  });

  it('refuses a listing placed on another campus', async () => {
    await assertFails(
      setDoc(
        doc(asElla(), 'listings', 'listing-elsewhere'),
        listingDoc(ELLA, { id: 'listing-elsewhere', campusId: 'some-other-school' }),
      ),
    );
  });

  it('stops her faking the price on an existing listing’s counters', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'listings', 'listing-1'), { 'stats.saveCount': 500 }),
    );
  });

  it('stops her marking her own listing removed — that goes through a function', async () => {
    // Removing has to check for rental history first, which the app cannot
    // see, so there is exactly one path and it is server-side.
    await assertFails(updateDoc(doc(asElla(), 'listings', 'listing-1'), { status: 'removed' }));
  });

  it('lets her pause and unpause her own listing', async () => {
    await assertSucceeds(updateDoc(doc(asElla(), 'listings', 'listing-1'), { status: 'paused' }));
    await assertSucceeds(updateDoc(doc(asElla(), 'listings', 'listing-1'), { status: 'active' }));
  });

  it('stops her reassigning a listing to someone else', async () => {
    await assertFails(updateDoc(doc(asElla(), 'listings', 'listing-1'), { ownerUid: MADDIE }));
  });

  it('stops a suspended account listing anything', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', MADDIE), userDoc(MADDIE, { status: 'suspended' }));
    });
    await assertFails(
      setDoc(doc(asMaddie(), 'listings', 'listing-x'), listingDoc(MADDIE, { id: 'listing-x' })),
    );
  });

  it('stops an unverified student listing anything', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', MADDIE), userDoc(MADDIE, { isVerified: false }));
    });
    await assertFails(
      setDoc(doc(asMaddie(), 'listings', 'listing-y'), listingDoc(MADDIE, { id: 'listing-y' })),
    );
  });
});

describe('bookings', () => {
  it('cannot be written by the app at all — only Cloud Functions', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'bookings', 'booking-1'), {
        id: 'booking-1',
        renterUid: ELLA,
        lenderUid: MADDIE,
        status: 'confirmed',
      }),
    );
  });

  it('is readable by the two people in it and nobody else', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'bookings', 'booking-1'), {
        id: 'booking-1',
        renterUid: ELLA,
        lenderUid: MADDIE,
        campusId: CAMPUS,
        status: 'confirmed',
      });
      await setDoc(doc(ctx.firestore(), 'users', 'uid-nosy'), userDoc('uid-nosy'));
    });

    await assertSucceeds(getDoc(doc(asElla(), 'bookings', 'booking-1')));
    await assertSucceeds(getDoc(doc(asMaddie(), 'bookings', 'booking-1')));
    await assertFails(
      getDoc(doc(testEnv.authenticatedContext('uid-nosy').firestore(), 'bookings', 'booking-1')),
    );
  });
});

function postDoc(authorUid: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    campusId: CAMPUS,
    authorUid,
    author: {
      uid: authorUid,
      username: authorUid,
      displayName: 'Test',
      photoUrl: null,
      campusId: CAMPUS,
      isVerified: true,
    },
    photos: [
      {
        path: `users/${authorUid}/posts/post-1/1.jpg`,
        url: 'https://example.test/p.jpg',
        width: 1200,
        height: 1500,
        tags: [],
      },
    ],
    caption: 'gameday fit secured',
    occasions: ['gameday'],
    taggedListings: [],
    taggedListingIds: [],
    circleId: null,
    status: 'active',
    stats: { likeCount: 0, saveCount: 0, viewCount: 0, tagTapCount: 0 },
    suspendedReason: null,
    removedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('posts', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'posts', 'post-1'), postDoc(ELLA));
    });
  });

  it('cannot be created by the app at all — createPost owns it', async () => {
    // A post reaches outside its own document: tagging bumps tagCount on
    // a listing, and taggedListingIds has to match the photos. Rules
    // cannot do either, so there is exactly one path.
    await assertFails(setDoc(doc(asElla(), 'posts', 'post-new'), postDoc(ELLA, { id: 'post-new' })));
  });

  it('lets her fix her own caption and occasions', async () => {
    await assertSucceeds(
      updateDoc(doc(asElla(), 'posts', 'post-1'), {
        caption: 'rush week day three',
        occasions: ['rush'],
      }),
    );
  });

  it('stops her editing someone else’s caption', async () => {
    await assertFails(updateDoc(doc(asMaddie(), 'posts', 'post-1'), { caption: 'mine now' }));
  });

  it('stops her changing the photos or the tags after publishing', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'posts', 'post-1'), {
        photos: [
          {
            path: 'x',
            url: 'https://example.test/x.jpg',
            width: 10,
            height: 10,
            tags: [{ x: 0.5, y: 0.5, listingId: 'listing-1', ownerUid: ELLA, label: {} }],
          },
        ],
      }),
    );
  });

  it('stops her inventing a like count', async () => {
    await assertFails(updateDoc(doc(asElla(), 'posts', 'post-1'), { 'stats.likeCount': 900 }));
  });

  it('stops her tagging listings by editing taggedListingIds directly', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'posts', 'post-1'), { taggedListingIds: ['listing-1'] }),
    );
  });

  it('stops her deleting a post outright — deletePost hands back tag counts', async () => {
    await assertFails(deleteDoc(doc(asElla(), 'posts', 'post-1')));
    await assertFails(updateDoc(doc(asElla(), 'posts', 'post-1'), { status: 'removed' }));
  });
});

describe('post likes and saves', () => {
  it('a like cannot be written by the app', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'likes', `${ELLA}_post-1`), {
        uid: ELLA,
        postId: 'post-1',
        postAuthorUid: MADDIE,
        campusId: CAMPUS,
      }),
    );
  });

  it('a post save cannot be written by the app', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'postSaves', `${ELLA}_post-1`), {
        uid: ELLA,
        postId: 'post-1',
        campusId: CAMPUS,
      }),
    );
  });

  it('a post save is readable only by the person who saved it', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'postSaves', `${ELLA}_post-1`), {
        uid: ELLA,
        postId: 'post-1',
        campusId: CAMPUS,
      });
    });
    await assertSucceeds(getDoc(doc(asElla(), 'postSaves', `${ELLA}_post-1`)));
    await assertFails(getDoc(doc(asMaddie(), 'postSaves', `${ELLA}_post-1`)));
  });
});

describe('follows', () => {
  it('cannot be written by the app — follower counts would be fiction', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'follows', `${ELLA}_${MADDIE}`), {
        followerUid: ELLA,
        followingUid: MADDIE,
        campusId: CAMPUS,
      }),
    );
  });
});

describe('saves', () => {
  it('cannot be written by the app — it drives the listing save count', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'saves', `${ELLA}_listing-1`), {
        uid: ELLA,
        listingId: 'listing-1',
        campusId: CAMPUS,
      }),
    );
  });

  it('is readable only by the person who saved it', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'saves', `${ELLA}_listing-1`), {
        uid: ELLA,
        listingId: 'listing-1',
        campusId: CAMPUS,
      });
    });
    await assertSucceeds(getDoc(doc(asElla(), 'saves', `${ELLA}_listing-1`)));
    await assertFails(getDoc(doc(asMaddie(), 'saves', `${ELLA}_listing-1`)));
  });
});

describe('bookings, in detail', () => {
  const OUTSIDER = 'uid-nosy';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', OUTSIDER), userDoc(OUTSIDER));
      await setDoc(doc(ctx.firestore(), 'bookings', 'booking-1'), {
        id: 'booking-1',
        kind: 'rental',
        status: 'requested',
        campusId: CAMPUS,
        listingId: 'listing-1',
        lenderUid: ELLA,
        renterUid: MADDIE,
        startDate: '2026-11-06',
        endDate: '2026-11-09',
      });
    });
  });

  it('is readable by the lender and the renter, and nobody else', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'bookings', 'booking-1')));
    await assertSucceeds(getDoc(doc(asMaddie(), 'bookings', 'booking-1')));
    await assertFails(
      getDoc(doc(testEnv.authenticatedContext(OUTSIDER).firestore(), 'bookings', 'booking-1')),
    );
  });

  it('cannot be moved to confirmed from the app', async () => {
    // Every status change goes through a function that checks the
    // transition table. If the app could write status, a renter could
    // confirm her own booking.
    await assertFails(updateDoc(doc(asMaddie(), 'bookings', 'booking-1'), { status: 'confirmed' }));
    await assertFails(updateDoc(doc(asElla(), 'bookings', 'booking-1'), { status: 'confirmed' }));
  });

  it('cannot have its price rewritten', async () => {
    await assertFails(
      updateDoc(doc(asMaddie(), 'bookings', 'booking-1'), { 'amounts.renterTotalCents': 1 }),
    );
  });

  it('cannot have a handoff confirmation forged', async () => {
    await assertFails(
      updateDoc(doc(asMaddie(), 'bookings', 'booking-1'), {
        'handoff.renterConfirmedReceiptAt': new Date(),
      }),
    );
  });

  it('cannot be created by the app', async () => {
    await assertFails(
      setDoc(doc(asMaddie(), 'bookings', 'booking-new'), {
        id: 'booking-new',
        status: 'confirmed',
        lenderUid: ELLA,
        renterUid: MADDIE,
      }),
    );
  });

  it('cannot be deleted', async () => {
    await assertFails(deleteDoc(doc(asElla(), 'bookings', 'booking-1')));
  });
});

describe('listing availability', () => {
  it('stops an owner hiding a booked weekend', async () => {
    // bookedDates is derived from the bookings by a Cloud Function. If
    // the app could write it, a lender could quietly clear a day she has
    // already promised to someone.
    await assertFails(updateDoc(doc(asElla(), 'listings', 'listing-1'), { bookedDates: [] }));
  });

  it('lets an owner set her own blocked dates', async () => {
    await assertSucceeds(
      updateDoc(doc(asElla(), 'listings', 'listing-1'), { blackoutDates: ['2026-11-01'] }),
    );
  });
});

describe('notifications', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA, 'notifications', 'n1'), {
        id: 'n1',
        uid: ELLA,
        type: 'rental_accepted',
        title: 'Your rental is confirmed',
        body: 'x',
        readAt: null,
      });
    });
  });

  it('is readable only by the person it is for', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'users', ELLA, 'notifications', 'n1')));
    await assertFails(getDoc(doc(asMaddie(), 'users', ELLA, 'notifications', 'n1')));
  });

  it('lets her mark one read, but not rewrite it', async () => {
    await assertSucceeds(
      updateDoc(doc(asElla(), 'users', ELLA, 'notifications', 'n1'), { readAt: new Date() }),
    );
    await assertFails(
      updateDoc(doc(asElla(), 'users', ELLA, 'notifications', 'n1'), { title: 'fake' }),
    );
  });

  it('cannot be created by the app', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'users', ELLA, 'notifications', 'n2'), {
        id: 'n2',
        uid: ELLA,
        type: 'rental_accepted',
        title: 'fake',
      }),
    );
  });
});

describe('conversations', () => {
  const OUTSIDER2 = 'uid-outsider2';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', OUTSIDER2), userDoc(OUTSIDER2));
      await setDoc(doc(ctx.firestore(), 'conversations', 'chat-1'), {
        id: 'chat-1',
        campusId: CAMPUS,
        participantUids: [ELLA, MADDIE],
        participants: {},
        lastMessage: { body: 'hi', senderUid: MADDIE, sentAt: new Date() },
        unreadCounts: { [ELLA]: 2, [MADDIE]: 0 },
      });
      await setDoc(doc(ctx.firestore(), 'conversations', 'chat-1', 'messages', 'm1'), {
        conversationId: 'chat-1',
        senderUid: MADDIE,
        body: 'hi',
        readBy: [MADDIE],
        isDeleted: false,
      });
    });
  });

  it('is readable only by the two people in it', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'conversations', 'chat-1')));
    await assertSucceeds(getDoc(doc(asMaddie(), 'conversations', 'chat-1')));
    await assertFails(
      getDoc(doc(testEnv.authenticatedContext(OUTSIDER2).firestore(), 'conversations', 'chat-1')),
    );
  });

  it('keeps its messages private from everyone else', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'conversations', 'chat-1', 'messages', 'm1')));
    await assertFails(
      getDoc(
        doc(
          testEnv.authenticatedContext(OUTSIDER2).firestore(),
          'conversations',
          'chat-1',
          'messages',
          'm1',
        ),
      ),
    );
  });

  it('lets a participant send a message as herself', async () => {
    await assertSucceeds(
      setDoc(doc(asElla(), 'conversations', 'chat-1', 'messages', 'm2'), {
        conversationId: 'chat-1',
        senderUid: ELLA,
        body: 'hello',
        readBy: [ELLA],
        isDeleted: false,
      }),
    );
  });

  it('stops her sending a message as someone else', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'conversations', 'chat-1', 'messages', 'm3'), {
        conversationId: 'chat-1',
        senderUid: MADDIE,
        body: 'forged',
        readBy: [ELLA],
        isDeleted: false,
      }),
    );
  });

  it('refuses a shared look written by the app', async () => {
    // sharePost writes these, because it moves the post's share count
    // and the snapshot has to be the real post. The app writing one
    // directly would be a bubble nobody counted.
    await assertFails(
      setDoc(doc(asElla(), 'conversations', 'chat-1', 'messages', 'm-share'), {
        conversationId: 'chat-1',
        senderUid: ELLA,
        body: 'look at this',
        readBy: [ELLA],
        isDeleted: false,
        sharedPost: {
          postId: 'post-1',
          photoUrl: null,
          caption: 'forged',
          authorUsername: 'someone',
        },
      }),
    );
  });

  it('still allows an ordinary message that says sharedPost is null', async () => {
    await assertSucceeds(
      setDoc(doc(asElla(), 'conversations', 'chat-1', 'messages', 'm-plain'), {
        conversationId: 'chat-1',
        senderUid: ELLA,
        body: 'hello',
        readBy: [ELLA],
        isDeleted: false,
        photo: null,
        sharedPost: null,
      }),
    );
  });

  it('stops an outsider posting into the thread', async () => {
    await assertFails(
      setDoc(
        doc(
          testEnv.authenticatedContext(OUTSIDER2).firestore(),
          'conversations',
          'chat-1',
          'messages',
          'm4',
        ),
        { conversationId: 'chat-1', senderUid: OUTSIDER2, body: 'hi', readBy: [], isDeleted: false },
      ),
    );
  });

  it('stops her editing what was said', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'conversations', 'chat-1', 'messages', 'm1'), { body: 'rewritten' }),
    );
  });

  it('lets her clear her own badge', async () => {
    await assertSucceeds(
      updateDoc(doc(asElla(), 'conversations', 'chat-1'), { [`unreadCounts.${ELLA}`]: 0 }),
    );
  });

  it('stops her clearing the other person’s badge', async () => {
    // Ella's count starts at 2, so this is a real change rather than a
    // no-op write — which would be allowed, and would prove nothing.
    await assertFails(
      updateDoc(doc(asMaddie(), 'conversations', 'chat-1'), { [`unreadCounts.${ELLA}`]: 0 }),
    );
  });

  it('stops her rewriting the last-message preview', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'conversations', 'chat-1'), {
        lastMessage: { body: 'fake', senderUid: MADDIE, sentAt: new Date() },
      }),
    );
  });
});

describe('reviews', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reviews', 'review-1'), {
        id: 'review-1',
        campusId: CAMPUS,
        bookingId: 'booking-1',
        authorUid: MADDIE,
        subjectUid: ELLA,
        authorRole: 'renter',
        rating: 5,
        body: 'lovely',
        isHidden: false,
      });
    });
  });

  it('cannot be written by the app — only by someone who rented with you', async () => {
    await assertFails(
      setDoc(doc(asMaddie(), 'reviews', 'review-fake'), {
        id: 'review-fake',
        authorUid: MADDIE,
        subjectUid: ELLA,
        rating: 5,
        isHidden: false,
      }),
    );
  });

  it('cannot have its rating edited directly', async () => {
    await assertFails(updateDoc(doc(asMaddie(), 'reviews', 'review-1'), { rating: 1 }));
  });

  it('cannot be hidden by the person it is about', async () => {
    await assertFails(updateDoc(doc(asElla(), 'reviews', 'review-1'), { isHidden: true }));
  });
});

describe('blocks', () => {
  it('are written only by the block function', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'users', ELLA, 'blocked', MADDIE), { blockedUid: MADDIE }),
    );
  });

  it('are readable only by the person they belong to', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA, 'blocked', MADDIE), {
        blockedUid: MADDIE,
      });
    });
    await assertSucceeds(getDoc(doc(asElla(), 'users', ELLA, 'blocked', MADDIE)));
    await assertFails(getDoc(doc(asMaddie(), 'users', ELLA, 'blocked', MADDIE)));
  });
});

describe('admin-only data', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA, 'adminNotes', 'note-1'), {
        id: 'note-1',
        uid: ELLA,
        note: 'Warned about off-platform payment.',
        adminUid: ADMIN,
      });
      await setDoc(doc(ctx.firestore(), 'adminActions', 'action-1'), {
        id: 'action-1',
        adminUid: ADMIN,
        action: 'suspend_user',
        targetType: 'user',
        targetId: MADDIE,
        notes: 'Repeated off-platform requests.',
      });
    });
  });

  it('keeps admin notes hidden from the student they are about', async () => {
    // Half the point of a private note is being able to write "watch
    // this one" honestly.
    await assertFails(getDoc(doc(asElla(), 'users', ELLA, 'adminNotes', 'note-1')));
    await assertSucceeds(getDoc(doc(asAdmin(), 'users', ELLA, 'adminNotes', 'note-1')));
  });

  it('stops anyone writing an admin note from the app', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'users', ELLA, 'adminNotes', 'note-2'), { note: 'x' }),
    );
  });

  it('keeps the audit log readable by admins and nobody else', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'adminActions', 'action-1')));
    await assertFails(getDoc(doc(asElla(), 'adminActions', 'action-1')));
  });

  it('makes the audit log append-only, even for an admin', async () => {
    // An audit log an admin can rewrite is not an audit log.
    await assertFails(updateDoc(doc(asAdmin(), 'adminActions', 'action-1'), { notes: 'nicer' }));
    await assertFails(deleteDoc(doc(asAdmin(), 'adminActions', 'action-1')));
  });
});

describe('suspension', () => {
  it('stops a suspended student listing, posting or messaging', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA), userDoc(ELLA, { status: 'suspended' }));
      await setDoc(doc(ctx.firestore(), 'conversations', 'chat-s'), {
        id: 'chat-s',
        campusId: CAMPUS,
        participantUids: [ELLA, MADDIE],
        participants: {},
        unreadCounts: { [ELLA]: 0, [MADDIE]: 0 },
      });
    });

    await assertFails(
      setDoc(doc(asElla(), 'listings', 'listing-sus'), listingDoc(ELLA, { id: 'listing-sus' })),
    );
    await assertFails(
      setDoc(doc(asElla(), 'conversations', 'chat-s', 'messages', 'm-sus'), {
        conversationId: 'chat-s',
        senderUid: ELLA,
        body: 'hi',
        readBy: [ELLA],
        isDeleted: false,
      }),
    );
  });

  it('still lets her read, so she can see why', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA), userDoc(ELLA, { status: 'suspended' }));
    });
    await assertSucceeds(getDoc(doc(asElla(), 'users', ELLA)));
    await assertSucceeds(getDoc(doc(asElla(), 'listings', 'listing-1')));
  });

  it('stops her lifting her own suspension', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA), userDoc(ELLA, { status: 'suspended' }));
    });
    await assertFails(updateDoc(doc(asElla(), 'users', ELLA), { status: 'active' }));
    await assertFails(updateDoc(doc(asElla(), 'users', ELLA), { suspendedReason: null }));
  });
});

describe('social counters', () => {
  it('stops her writing her own like (that is a function’s job)', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'likes', `${ELLA}_post-1`), {
        uid: ELLA,
        postId: 'post-1',
      }),
    );
  });

  it('stops her writing a follow edge directly', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'follows', `${ELLA}_${MADDIE}`), {
        followerUid: ELLA,
        followingUid: MADDIE,
      }),
    );
  });
});

describe('events', () => {
  /** A row that satisfies every rule, for tests to break one thing in. */
  const goodEvent = (overrides: Record<string, unknown> = {}) => ({
    type: 'listing_view',
    uid: ELLA,
    campusId: CAMPUS,
    surface: 'discover',
    targetType: 'listing',
    targetId: 'listing-1',
    meta: {},
    sessionId: 'session-abc',
    platform: 'ios',
    appVersion: '0.1.0',
    createdAt: serverTimestamp(),
    ...overrides,
  });

  it('lets her log her own event', async () => {
    await assertSucceeds(setDoc(doc(asElla(), 'events', 'event-1'), goodEvent()));
  });

  it('stops her logging an event as someone else', async () => {
    await assertFails(setDoc(doc(asElla(), 'events', 'event-2'), goodEvent({ uid: MADDIE })));
  });

  it('stops her attributing an event to another campus', async () => {
    // One student poisoning another campus's numbers is the kind of
    // thing nobody notices until a decision has been made on it.
    await assertFails(
      setDoc(doc(asElla(), 'events', 'event-3'), goodEvent({ campusId: 'clemson' })),
    );
  });

  it('stops her inventing an event type', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'events', 'event-4'), goodEvent({ type: 'tagged_item_tap_lol' })),
    );
  });

  it('stops her inventing a surface', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'events', 'event-5'), goodEvent({ surface: 'somewhere' })),
    );
  });

  it('stops her backdating an event', async () => {
    // A backdated row lands in a week we have already reported on.
    await assertFails(
      setDoc(doc(asElla(), 'events', 'event-6'), goodEvent({ createdAt: new Date(2020, 0, 1) })),
    );
  });

  it('stops her stuffing a payload into meta', async () => {
    const fat: Record<string, string> = {};
    for (let i = 0; i < 40; i += 1) fat[`k${i}`] = 'v';
    await assertFails(setDoc(doc(asElla(), 'events', 'event-7'), goodEvent({ meta: fat })));
  });

  it('stops her making up a platform', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'events', 'event-8'), goodEvent({ platform: 'toaster' })),
    );
  });

  it('stops her reading the event stream', async () => {
    await assertFails(getDoc(doc(asElla(), 'events', 'event-1')));
  });

  it('lists every EVENT_TYPE and EVENT_SURFACE the app can send', () => {
    // Rules cannot import from shared, so the allowed lists are copied
    // into firestore.rules. This is the guard against them drifting:
    // add a type to constants.ts without adding it to the rules and
    // every event of that type would be silently refused in production.
    const rules = readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8');
    const missingTypes = EVENT_TYPES.filter((t) => !rules.includes(`'${t}'`));
    const missingSurfaces = EVENT_SURFACES.filter((s) => !rules.includes(`'${s}'`));
    if (missingTypes.length > 0 || missingSurfaces.length > 0) {
      throw new Error(
        `firestore.rules is missing event types [${missingTypes.join(', ')}] ` +
          `and surfaces [${missingSurfaces.join(', ')}]`,
      );
    }
  });
});

describe('moderation', () => {
  it('stops a student reading reports about her', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reports', 'report-1'), {
        reporterUid: MADDIE,
        targetUid: ELLA,
        targetType: 'user',
        status: 'open',
      });
    });
    await assertFails(getDoc(doc(asElla(), 'reports', 'report-1')));
    await assertSucceeds(getDoc(doc(asAdmin(), 'reports', 'report-1')));
  });
});

describe('usernames', () => {
  it('cannot be claimed directly — only inside the signup transaction', async () => {
    await assertFails(setDoc(doc(asElla(), 'usernames', 'stolen'), { username: 'stolen', uid: ELLA }));
  });
});

describe('comments', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'posts', 'post-c'), postDoc(ELLA));
      await setDoc(doc(db, 'comments', 'comment-1'), {
        id: 'comment-1',
        campusId: CAMPUS,
        postId: 'post-c',
        authorUid: MADDIE,
        author: { uid: MADDIE, username: 'maddie', displayName: 'Maddie', photoUrl: null },
        body: 'obsessed with this',
        parentCommentId: null,
        status: 'active',
        suspendedReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  });

  it('is readable by any signed-in student', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'comments', 'comment-1')));
  });

  it('is not readable by someone signed out', async () => {
    await assertFails(getDoc(doc(asStranger(), 'comments', 'comment-1')));
  });

  it('refuses a comment written straight from the app', async () => {
    // addComment writes these, because the count under the post has to
    // move with the comment.
    await assertFails(
      setDoc(doc(asMaddie(), 'comments', 'comment-2'), {
        id: 'comment-2',
        campusId: CAMPUS,
        postId: 'post-c',
        authorUid: MADDIE,
        author: { uid: MADDIE, username: 'maddie', displayName: 'Maddie', photoUrl: null },
        body: 'straight from the phone',
        status: 'active',
        suspendedReason: null,
      }),
    );
  });

  it('refuses a comment signed with somebody else\'s name', async () => {
    await assertFails(
      setDoc(doc(asMaddie(), 'comments', 'comment-3'), {
        id: 'comment-3',
        campusId: CAMPUS,
        postId: 'post-c',
        authorUid: ELLA,
        author: { uid: ELLA, username: 'ella', displayName: 'Ella', photoUrl: null },
        body: 'forged',
        status: 'active',
        suspendedReason: null,
      }),
    );
  });

  it('stops her deleting her own comment directly', async () => {
    // Soft-deleting has to hand back the count, so it goes through
    // deleteComment rather than a write from here.
    await assertFails(updateDoc(doc(asMaddie(), 'comments', 'comment-1'), { status: 'removed' }));
  });

  it('stops the post author quietly editing what somebody said', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'comments', 'comment-1'), { body: 'something else entirely' }),
    );
  });

  it('stops even an admin writing one by hand', async () => {
    // hideComment writes the audit row in the same batch. A hand write
    // would change the comment with no record of who did it.
    await assertFails(
      updateDoc(doc(asAdmin(), 'comments', 'comment-1'), { status: 'suspended' }),
    );
  });
});

describe('post counters', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'posts', 'post-s'), postDoc(ELLA));
    });
  });

  it('stops her inflating her own comment count', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'posts', 'post-s'), { 'stats.commentCount': 99 }),
    );
  });

  it('stops her inflating her own share count', async () => {
    await assertFails(updateDoc(doc(asElla(), 'posts', 'post-s'), { 'stats.shareCount': 99 }));
  });

  it('stops her putting a made-up name on the "liked by" line', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'posts', 'post-s'), {
        lastLiker: { uid: MADDIE, username: 'maddie', displayName: 'Maddie', photoUrl: null },
      }),
    );
  });

  it('still lets her fix her own caption', async () => {
    await assertSucceeds(
      updateDoc(doc(asElla(), 'posts', 'post-s'), { caption: 'formal szn', updatedAt: new Date() }),
    );
  });
});

describe('private settings', () => {
  const PRIVATE = ['users', ELLA, 'private', 'settings'] as const;

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...PRIVATE), {
        uid: ELLA,
        accountEmail: 'ella@email.sc.edu',
        campusEmail: 'ella@email.sc.edu',
        phone: null,
        handoffNotes: null,
        notificationPreferences: { pushEnabled: true },
        updatedAt: new Date(),
      });
    });
  });

  it('is readable by her', async () => {
    await assertSucceeds(getDoc(doc(asElla(), ...PRIVATE)));
  });

  it('is readable by an admin', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), ...PRIVATE)));
  });

  it('is NOT readable by another student', async () => {
    // This is the whole point of the move: her school email used to sit
    // on a document every signed-in student could read.
    await assertFails(getDoc(doc(asMaddie(), ...PRIVATE)));
  });

  it('lets her change her phone number', async () => {
    await assertSucceeds(
      updateDoc(doc(asElla(), ...PRIVATE), { phone: '803-555-0100', updatedAt: new Date() }),
    );
  });

  it('stops her rewriting her own campus email', async () => {
    // Her claim to be a student at this school rests on that address.
    await assertFails(updateDoc(doc(asElla(), ...PRIVATE), { campusEmail: 'ella@harvard.edu' }));
  });

  it('stops her rewriting her account email', async () => {
    await assertFails(updateDoc(doc(asElla(), ...PRIVATE), { accountEmail: 'other@gmail.com' }));
  });

  it('stops her deleting it', async () => {
    await assertFails(deleteDoc(doc(asElla(), ...PRIVATE)));
  });
});

describe('the show-sizes toggle', () => {
  it('lets her turn her sizes on', async () => {
    await assertSucceeds(
      updateDoc(doc(asElla(), 'users', ELLA), { showSizes: true, updatedAt: new Date() }),
    );
  });

  it('stops her flipping it on someone else', async () => {
    await assertFails(updateDoc(doc(asElla(), 'users', MADDIE), { showSizes: true }));
  });
});
