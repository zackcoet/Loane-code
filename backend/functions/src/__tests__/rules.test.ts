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
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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
    campusEmail: `${uid}@email.sc.edu`,
    isVerified: true,
    verificationMethod: 'domain_claimed',
    verifiedAt: new Date(),
    sizes: { general: null, shoe: null },
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
    photos: [],
    coverUrl: null,
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
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(asElla(), 'listings', 'listing-1')));
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
  it('lets her log her own event', async () => {
    await assertSucceeds(
      setDoc(doc(asElla(), 'events', 'event-1'), {
        type: 'listing_view',
        uid: ELLA,
        campusId: CAMPUS,
        surface: 'discover',
      }),
    );
  });

  it('stops her logging an event as someone else', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'events', 'event-2'), {
        type: 'listing_view',
        uid: MADDIE,
        campusId: CAMPUS,
        surface: 'discover',
      }),
    );
  });

  it('stops her reading the event stream', async () => {
    await assertFails(getDoc(doc(asElla(), 'events', 'event-1')));
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
