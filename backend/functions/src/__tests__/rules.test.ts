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
import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { EVENT_SURFACES, EVENT_TYPES, newUserStripe } from '@loane/shared';
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
    legalAccepted: {
      termsVersion: 1,
      termsAcceptedAt: new Date(),
      privacyVersion: 1,
      privacyAcceptedAt: new Date(),
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
      {
        path: `users/${ownerUid}/listings/listing-1/1.jpg`,
        url: 'https://example.test/1.jpg',
        width: 1200,
        height: 1600,
      },
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
type Firestore = ReturnType<typeof asElla>;

/**
 * Sends a message the way the app does: in one batch with a tick of
 * the sender's hourly counter (messageQuotas). Without the tick the
 * rules refuse every message, so tests about other message rules use
 * this to make sure the counter is never the reason they pass or fail.
 */
async function sendAs(
  db: Firestore,
  conversationId: string,
  messageId: string,
  data: Record<string, unknown>,
  senderUid = (data.senderUid as string) ?? ELLA,
) {
  const quotaRef = doc(db, 'messageQuotas', senderUid);
  const quota = await getDoc(quotaRef).catch(() => null);
  const batch = writeBatch(db);
  batch.set(doc(db, 'conversations', conversationId, 'messages', messageId), data);
  if (quota?.exists()) batch.update(quotaRef, { count: increment(1) });
  else batch.set(quotaRef, { windowStart: serverTimestamp(), count: 1 });
  return batch.commit();
}

/**
 * Creates a listing the way the app does: in one batch with a tick of
 * her hourly new-piece counter (listingQuotas). Without the tick the
 * rules refuse every new listing, so tests about other listing rules
 * use this to make sure the counter is never why they pass or fail.
 */
async function createListingAs(
  callerUid: string,
  listingId: string,
  data: Record<string, unknown>,
) {
  const db = testEnv.authenticatedContext(callerUid).firestore();
  const quotaRef = doc(db, 'listingQuotas', callerUid);
  const quota = await getDoc(quotaRef).catch(() => null);
  const batch = writeBatch(db);
  batch.set(doc(db, 'listings', listingId), data);
  if (quota?.exists()) batch.update(quotaRef, { count: increment(1) });
  else batch.set(quotaRef, { windowStart: serverTimestamp(), count: 1 });
  return batch.commit();
}

describe('users', () => {
  it('lets her edit her own bio', async () => {
    await assertSucceeds(
      updateDoc(doc(asElla(), 'users', ELLA), { bio: 'usc • sharing my closet' }),
    );
  });

  it('caps her bio and names at the app’s limits', async () => {
    const me = doc(asElla(), 'users', ELLA);
    await assertSucceeds(updateDoc(me, { bio: 'a'.repeat(200) }));
    await assertFails(updateDoc(me, { bio: 'a'.repeat(201) }));
    await assertFails(updateDoc(me, { bio: 42 }));
    await assertSucceeds(updateDoc(me, { displayName: 'b'.repeat(40) }));
    await assertFails(updateDoc(me, { displayName: 'b'.repeat(41) }));
    await assertFails(updateDoc(me, { displayName: '' }));
    await assertFails(updateDoc(me, { firstName: 'c'.repeat(41) }));
  });

  it('still lets an old over-long bio change her other fields', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA), userDoc(ELLA, { bio: 'x'.repeat(300) }));
    });
    await assertSucceeds(updateDoc(doc(asElla(), 'users', ELLA), { showSizes: true }));
  });

  it('stops her editing someone else’s profile', async () => {
    await assertFails(updateDoc(doc(asMaddie(), 'users', ELLA), { bio: 'hacked' }));
  });

  it('stops her inventing her own follower count', async () => {
    await assertFails(updateDoc(doc(asElla(), 'users', ELLA), { 'stats.followerCount': 10_000 }));
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
    await assertFails(updateDoc(doc(asElla(), 'users', ELLA), { campusId: 'harvard' }));
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
  it('lets her turn her own read receipts off', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA, 'private', 'settings'), { uid: ELLA });
    });
    await assertSucceeds(
      updateDoc(doc(asElla(), 'users', ELLA, 'private', 'settings'), {
        messaging: { readReceipts: false },
      }),
    );
    await assertFails(
      updateDoc(doc(asMaddie(), 'users', ELLA, 'private', 'settings'), {
        messaging: { readReceipts: false },
      }),
    );
  });

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

describe('legal documents', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'legalDocs', 'terms_v1'), {
        id: 'terms_v1',
        kind: 'terms',
        title: 'Terms & Conditions',
        text: '# Terms',
        version: 1,
        effectiveDate: '2026-10-05',
        significantChange: false,
        publishedAt: new Date(),
        publishedByUid: ADMIN,
        publishedByEmail: 'admin@joinloane.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await setDoc(doc(ctx.firestore(), 'legalDrafts', 'terms'), {
        id: 'terms',
        kind: 'terms',
        title: 'Terms & Conditions',
        text: '# Draft terms',
        nextVersion: 2,
        effectiveDate: '2026-10-06',
        significantChange: true,
        updatedByUid: ADMIN,
        updatedByEmail: 'admin@joinloane.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  });

  it('lets anyone read published legal docs', async () => {
    await assertSucceeds(getDoc(doc(asStranger(), 'legalDocs', 'terms_v1')));
    await assertSucceeds(getDoc(doc(asElla(), 'legalDocs', 'terms_v1')));
  });

  it('stops direct writes to published legal docs, even by admins', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'legalDocs', 'terms_v2'), {
        id: 'terms_v2',
        kind: 'terms',
        title: 'Terms & Conditions',
        text: '# New terms',
        version: 2,
      }),
    );
    await assertFails(updateDoc(doc(asAdmin(), 'legalDocs', 'terms_v1'), { text: 'changed' }));
  });

  it('keeps drafts admin-readable but function-written', async () => {
    await assertFails(getDoc(doc(asStranger(), 'legalDrafts', 'terms')));
    await assertFails(getDoc(doc(asElla(), 'legalDrafts', 'terms')));
    await assertSucceeds(getDoc(doc(asAdmin(), 'legalDrafts', 'terms')));
    await assertFails(updateDoc(doc(asAdmin(), 'legalDrafts', 'terms'), { text: 'changed' }));
  });
});

describe('listings', () => {
  it('lets her create a listing in her own closet', async () => {
    await assertSucceeds(
      createListingAs(ELLA, 'listing-new', listingDoc(ELLA, { id: 'listing-new' })),
    );
  });

  it('lets her create one with "Available now" off', async () => {
    // The form writes status 'paused' when that toggle is off. create
    // used to allow only draft and active, so turning it off meant the
    // listing was refused — and the app blamed her connection for it.
    await assertSucceeds(
      createListingAs(ELLA, 'listing-paused',
        listingDoc(ELLA, { id: 'listing-paused', status: 'paused' }),
      ),
    );
  });

  it('still refuses a status the app never writes', async () => {
    for (const status of ['sold', 'suspended', 'removed']) {
      await assertFails(
        createListingAs(ELLA, `listing-${status}`,
          listingDoc(ELLA, { id: `listing-${status}`, status }),
        ),
      );
    }
  });

  it('stops her creating a listing owned by someone else', async () => {
    await assertFails(
      createListingAs(MADDIE, 'listing-fake', listingDoc(ELLA, { id: 'listing-fake' })),
    );
  });

  it('stops a new listing starting with a fake view count', async () => {
    await assertFails(
      createListingAs(ELLA, 'listing-inflated',
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

  // An admin takes a piece down by setting status 'suspended'; removing
  // one sets 'removed'. Either way the owner must not be able to flip
  // it straight back to 'active' from her phone.
  for (const status of ['suspended', 'removed']) {
    it(`stops her putting a ${status} listing back up herself`, async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'listings', 'listing-1'), { status });
      });
      await assertFails(updateDoc(doc(asElla(), 'listings', 'listing-1'), { status: 'active' }));
      await assertFails(updateDoc(doc(asElla(), 'listings', 'listing-1'), { name: 'Back again' }));
    });
  }

  it('still lets her pause and unpause her own listing', async () => {
    await assertSucceeds(updateDoc(doc(asElla(), 'listings', 'listing-1'), { status: 'paused' }));
    await assertSucceeds(updateDoc(doc(asElla(), 'listings', 'listing-1'), { status: 'active' }));
  });

  // --- Phase 2: the listing rules mirror validateListingDraft ----------

  it('refuses a listing with no photos', async () => {
    await assertFails(
      createListingAs(ELLA, 'listing-nophoto',
        listingDoc(ELLA, { id: 'listing-nophoto', photos: [], coverUrl: null }),
      ),
    );
  });

  it('refuses a listing with no occasions — nobody could ever find it', async () => {
    await assertFails(
      createListingAs(ELLA, 'listing-noocc',
        listingDoc(ELLA, { id: 'listing-noocc', occasions: [] }),
      ),
    );
  });

  it('refuses a rentable listing with no price', async () => {
    await assertFails(
      createListingAs(ELLA, 'listing-free',
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
      createListingAs(ELLA, 'listing-novalue',
        listingDoc(ELLA, { id: 'listing-novalue', garmentValueCents: 0 }),
      ),
    );
  });

  it('refuses a price that is not whole cents', async () => {
    await assertFails(
      createListingAs(ELLA, 'listing-float',
        listingDoc(ELLA, {
          id: 'listing-float',
          pricing: { threeDayCents: 25.5, sevenDayCents: 4000 },
        }),
      ),
    );
  });

  it('refuses a for-sale listing with no sale price', async () => {
    await assertFails(
      createListingAs(ELLA, 'listing-nosale',
        listingDoc(ELLA, { id: 'listing-nosale', intent: 'sell', salePriceCents: null }),
      ),
    );
  });

  it('refuses a listing placed on another campus', async () => {
    await assertFails(
      createListingAs(ELLA, 'listing-elsewhere',
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
      createListingAs(MADDIE, 'listing-x', listingDoc(MADDIE, { id: 'listing-x' })),
    );
  });

  it('stops an unverified student listing anything', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', MADDIE), userDoc(MADDIE, { isVerified: false }));
    });
    await assertFails(
      createListingAs(MADDIE, 'listing-y', listingDoc(MADDIE, { id: 'listing-y' })),
    );
  });
});

describe('listingQuotas — the hourly ceiling on new pieces', () => {
  const quotaDoc = (db: Firestore, uid = ELLA) => doc(db, 'listingQuotas', uid);
  const seedQuota = (data: Record<string, unknown>) =>
    testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'listingQuotas', ELLA), data);
    });

  it('refuses a new listing that does not tick her counter', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'listings', 'lq-plain'), listingDoc(ELLA, { id: 'lq-plain' })),
    );
  });

  it('counts new listings one at a time', async () => {
    await assertSucceeds(createListingAs(ELLA, 'lq-1', listingDoc(ELLA, { id: 'lq-1' })));
    await assertSucceeds(createListingAs(ELLA, 'lq-2', listingDoc(ELLA, { id: 'lq-2' })));
  });

  it('refuses the 61st new listing in an hour', async () => {
    await seedQuota({ windowStart: new Date(), count: 60 });
    await assertFails(createListingAs(ELLA, 'lq-61', listingDoc(ELLA, { id: 'lq-61' })));
  });

  it('starts a fresh hour once the old one is over', async () => {
    await seedQuota({ windowStart: new Date(Date.now() - 2 * 3_600_000), count: 60 });
    const ella = asElla();
    const batch = writeBatch(ella);
    batch.set(doc(ella, 'listings', 'lq-fresh'), listingDoc(ELLA, { id: 'lq-fresh' }));
    batch.set(quotaDoc(ella), { windowStart: serverTimestamp(), count: 1 });
    await assertSucceeds(batch.commit());
  });

  it('does not count edits to a piece she already has', async () => {
    await seedQuota({ windowStart: new Date(), count: 60 });
    await assertSucceeds(
      updateDoc(doc(asElla(), 'listings', 'listing-1'), { name: 'Still the same dress' }),
    );
  });

  it('refuses resetting, lowering or jumping her counter', async () => {
    await seedQuota({ windowStart: new Date(), count: 10 });
    await assertFails(setDoc(quotaDoc(asElla()), { windowStart: serverTimestamp(), count: 1 }));
    await assertFails(updateDoc(quotaDoc(asElla()), { count: 1 }));
    await assertFails(updateDoc(quotaDoc(asElla()), { count: 12 }));
    await assertFails(deleteDoc(quotaDoc(asElla())));
  });

  it('keeps her counter private and hers alone', async () => {
    await seedQuota({ windowStart: new Date(), count: 10 });
    await assertSucceeds(getDoc(quotaDoc(asElla())));
    await assertFails(getDoc(quotaDoc(asMaddie(), ELLA)));
    await assertFails(
      setDoc(quotaDoc(asMaddie(), ELLA), { windowStart: serverTimestamp(), count: 1 }),
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
    await assertFails(
      setDoc(doc(asElla(), 'posts', 'post-new'), postDoc(ELLA, { id: 'post-new' })),
    );
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

describe('comment likes', () => {
  it('a heart on a comment cannot be written by the app', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'commentLikes', `${ELLA}_comment-1`), {
        uid: ELLA,
        commentId: 'comment-1',
        postId: 'post-1',
        commentAuthorUid: MADDIE,
        campusId: CAMPUS,
      }),
    );
  });

  it('nor deleted by the app, even her own', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'commentLikes', `${ELLA}_comment-1`), {
        uid: ELLA,
        commentId: 'comment-1',
        postId: 'post-1',
        commentAuthorUid: MADDIE,
        campusId: CAMPUS,
      });
    });
    await assertFails(deleteDoc(doc(asElla(), 'commentLikes', `${ELLA}_comment-1`)));
  });

  it('is readable by any signed-in student, like a post like', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'commentLikes', `${ELLA}_comment-1`), {
        uid: ELLA,
        commentId: 'comment-1',
        postId: 'post-1',
        commentAuthorUid: MADDIE,
        campusId: CAMPUS,
      });
    });
    await assertSucceeds(getDoc(doc(asMaddie(), 'commentLikes', `${ELLA}_comment-1`)));
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
      sendAs(asElla(), 'chat-1', 'm2', {
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
      sendAs(asElla(), 'chat-1', 'm3', {
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
      sendAs(asElla(), 'chat-1', 'm-share', {
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
      sendAs(asElla(), 'chat-1', 'm-plain', {
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

  it('refuses a shared piece written by the app', async () => {
    // shareListing writes these, so the name and price in the card are
    // the real listing's. A forged "$5 to rent" card from someone
    // else's closet is the thing this stops.
    await assertFails(
      sendAs(asElla(), 'chat-1', 'm-share-listing', {
        conversationId: 'chat-1',
        senderUid: ELLA,
        body: 'would this work?',
        readBy: [ELLA],
        isDeleted: false,
        sharedPost: null,
        sharedListing: {
          listingId: 'listing-1',
          photoUrl: null,
          name: 'forged',
          ownerUsername: 'someone',
          intent: 'rent',
          rentFromCents: 500,
          salePriceCents: null,
        },
      }),
    );
  });

  it('still allows an ordinary message that says sharedListing is null', async () => {
    await assertSucceeds(
      sendAs(asElla(), 'chat-1', 'm-plain-2', {
        conversationId: 'chat-1',
        senderUid: ELLA,
        body: 'hello',
        readBy: [ELLA],
        isDeleted: false,
        photo: null,
        sharedPost: null,
        sharedListing: null,
      }),
    );
  });

  describe('blocked either way', () => {
    const plain = {
      conversationId: 'chat-1',
      senderUid: ELLA,
      body: 'still there?',
      readBy: [ELLA],
      isDeleted: false,
    };
    const block = (blocker: string, blocked: string) =>
      testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', blocker, 'blocked', blocked), {
          blockedUid: blocked,
        });
      });

    it('refuses a message after she blocked the other person', async () => {
      await block(ELLA, MADDIE);
      await assertFails(sendAs(asElla(), 'chat-1', 'b1', plain));
    });

    it('refuses a message after the other person blocked her', async () => {
      // The thread existed before the block — this is the case
      // openConversation cannot catch.
      await block(MADDIE, ELLA);
      await assertFails(sendAs(asElla(), 'chat-1', 'b2', plain));
    });

    it('refuses a heart once either has blocked', async () => {
      await block(MADDIE, ELLA);
      await assertFails(
        updateDoc(doc(asElla(), 'conversations', 'chat-1', 'messages', 'm1'), {
          likedBy: [ELLA],
        }),
      );
    });

    it('still lets her mark the thread read', async () => {
      await block(MADDIE, ELLA);
      await assertSucceeds(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), { [`unreadCounts.${ELLA}`]: 0 }),
      );
    });

    it('is not affected by a block with someone outside the thread', async () => {
      await block(ELLA, OUTSIDER2);
      await assertSucceeds(sendAs(asElla(), 'chat-1', 'b3', plain));
    });
  });

  describe('the hourly message ceiling', () => {
    const plain = {
      conversationId: 'chat-1',
      senderUid: ELLA,
      body: 'hi',
      readBy: [ELLA],
      isDeleted: false,
    };
    const quotaDoc = (db: Firestore, uid = ELLA) => doc(db, 'messageQuotas', uid);
    const seedQuota = (data: Record<string, unknown>) =>
      testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(quotaDoc(ctx.firestore()), data);
      });

    it('refuses a message that does not tick her counter', async () => {
      await assertFails(setDoc(doc(asElla(), 'conversations', 'chat-1', 'messages', 'q1'), plain));
    });

    it('counts messages one at a time', async () => {
      await assertSucceeds(sendAs(asElla(), 'chat-1', 'q2', plain));
      await assertSucceeds(sendAs(asElla(), 'chat-1', 'q3', plain));
    });

    it('refuses the message after the ceiling', async () => {
      await seedQuota({ windowStart: new Date(), count: 500 });
      await assertFails(sendAs(asElla(), 'chat-1', 'q4', plain));
    });

    it('starts a fresh hour once the old one is over', async () => {
      await seedQuota({ windowStart: new Date(Date.now() - 2 * 3_600_000), count: 500 });
      // One client for the whole batch — a batch refuses documents from
      // another Firestore instance, and asElla() makes a new one each call.
      const ella = asElla();
      const batch = writeBatch(ella);
      batch.set(doc(ella, 'conversations', 'chat-1', 'messages', 'q5'), plain);
      batch.set(quotaDoc(ella), { windowStart: serverTimestamp(), count: 1 });
      await assertSucceeds(batch.commit());
    });

    it('refuses resetting her counter before the hour is up', async () => {
      await seedQuota({ windowStart: new Date(), count: 500 });
      await assertFails(setDoc(quotaDoc(asElla()), { windowStart: serverTimestamp(), count: 1 }));
    });

    it('refuses lowering her counter or jumping it', async () => {
      await seedQuota({ windowStart: new Date(), count: 10 });
      await assertFails(updateDoc(quotaDoc(asElla()), { count: 1 }));
      await assertFails(updateDoc(quotaDoc(asElla()), { count: 12 }));
    });

    it('keeps her counter private and hers alone', async () => {
      await seedQuota({ windowStart: new Date(), count: 10 });
      await assertSucceeds(getDoc(quotaDoc(asElla())));
      await assertFails(getDoc(quotaDoc(asMaddie(), ELLA)));
      await assertFails(
        setDoc(quotaDoc(asMaddie(), ELLA), { windowStart: serverTimestamp(), count: 1 }),
      );
    });
  });

  describe('replying to a message', () => {
    const reply = (replyTo: Record<string, unknown>) =>
      sendAs(asElla(), 'chat-1', `m-reply-${Math.random()}`, {
        conversationId: 'chat-1',
        senderUid: ELLA,
        body: 'yes!',
        readBy: [ELLA],
        isDeleted: false,
        photo: null,
        sharedPost: null,
        replyTo,
      });
    const honest = {
      messageId: 'm1',
      senderUid: MADDIE,
      body: 'hi',
      hasPhoto: false,
      hasSharedPost: false,
    };

    it('lets her quote what was really said', async () => {
      await assertSucceeds(reply(honest));
    });

    it('allows a message that says replyTo is null', async () => {
      await assertSucceeds(
        sendAs(asElla(), 'chat-1', 'm-noreply', {
          conversationId: 'chat-1',
          senderUid: ELLA,
          body: 'hello',
          readBy: [ELLA],
          isDeleted: false,
          replyTo: null,
        }),
      );
    });

    it('refuses a quote that changes the words', async () => {
      await assertFails(reply({ ...honest, body: 'I will give it to you for free' }));
    });

    it('refuses a quote pinned on the wrong person', async () => {
      await assertFails(reply({ ...honest, senderUid: ELLA }));
    });

    it('refuses a quote of a message that does not exist', async () => {
      await assertFails(reply({ ...honest, messageId: 'nope' }));
    });

    it('refuses a quote of a message from another thread', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'chat-other', 'messages', 'mx'), {
          conversationId: 'chat-other',
          senderUid: MADDIE,
          body: 'secret',
          readBy: [MADDIE],
          isDeleted: false,
        });
      });
      await assertFails(reply({ ...honest, messageId: 'mx', body: 'secret' }));
    });

    it('refuses a quote of a message moderation took down', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'chat-1', 'messages', 'm-gone'), {
          conversationId: 'chat-1',
          senderUid: MADDIE,
          body: 'removed',
          readBy: [MADDIE],
          isDeleted: true,
        });
      });
      await assertFails(reply({ ...honest, messageId: 'm-gone', body: 'removed' }));
    });

    it('accepts the newer quote shape that says whether a piece was sent', async () => {
      await assertSucceeds(reply({ ...honest, hasSharedListing: false }));
    });

    it('refuses a quote that claims a piece was sent when none was', async () => {
      await assertFails(reply({ ...honest, hasSharedListing: true }));
    });

    it('lets her quote a piece someone sent', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'conversations', 'chat-1', 'messages', 'm-piece'), {
          conversationId: 'chat-1',
          senderUid: MADDIE,
          body: '',
          readBy: [MADDIE],
          isDeleted: false,
          photo: null,
          sharedPost: null,
          sharedListing: { listingId: 'listing-1' },
        });
      });
      await assertSucceeds(
        reply({ ...honest, messageId: 'm-piece', body: '', hasSharedListing: true }),
      );
    });

    it('refuses extra fields smuggled into the quote', async () => {
      await assertFails(reply({ ...honest, sharedPost: { postId: 'p' } }));
    });
  });

  it('stops an outsider posting into the thread', async () => {
    await assertFails(
      sendAs(testEnv.authenticatedContext(OUTSIDER2).firestore(), 'chat-1', 'm4', {
        conversationId: 'chat-1',
        senderUid: OUTSIDER2,
        body: 'hi',
        readBy: [],
        isDeleted: false,
      }),
    );
  });

  it('stops her editing what was said', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'conversations', 'chat-1', 'messages', 'm1'), { body: 'rewritten' }),
    );
  });

  describe('hearting a message', () => {
    const m1 = (as: ReturnType<typeof asElla>) =>
      doc(as, 'conversations', 'chat-1', 'messages', 'm1');

    it('lets her heart a message, and take it back', async () => {
      await assertSucceeds(updateDoc(m1(asElla()), { likedBy: [ELLA], updatedAt: new Date() }));
      await assertSucceeds(updateDoc(m1(asElla()), { likedBy: [] }));
    });

    it('refuses a heart in someone else’s name', async () => {
      await assertFails(updateDoc(m1(asElla()), { likedBy: [MADDIE] }));
    });

    it('refuses taking back the other person’s heart', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'conversations', 'chat-1', 'messages', 'm1'), {
          likedBy: [MADDIE],
        });
      });
      await assertFails(updateDoc(m1(asElla()), { likedBy: [] }));
      await assertSucceeds(updateDoc(m1(asElla()), { likedBy: [MADDIE, ELLA] }));
    });

    it('refuses hearting while also changing the words', async () => {
      await assertFails(updateDoc(m1(asElla()), { likedBy: [ELLA], body: 'rewritten' }));
    });

    it('refuses a heart on a message moderation took down', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'conversations', 'chat-1', 'messages', 'm1'), {
          isDeleted: true,
        });
      });
      await assertFails(updateDoc(m1(asElla()), { likedBy: [ELLA] }));
    });

    it('refuses an outsider hearting', async () => {
      await assertFails(
        updateDoc(m1(testEnv.authenticatedContext(OUTSIDER2).firestore()), {
          likedBy: [OUTSIDER2],
        }),
      );
    });
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

  describe('"Seen" — when she last had the thread open', () => {
    it('lets her stamp her own, on the server clock, with her badge', async () => {
      await assertSucceeds(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), {
          [`unreadCounts.${ELLA}`]: 0,
          [`lastReadAt.${ELLA}`]: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
    });

    it('refuses a time she picked herself', async () => {
      // A phone-chosen time could claim she saw a message before it was
      // ever sent, or that she never saw one she did.
      await assertFails(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), {
          [`lastReadAt.${ELLA}`]: new Date('2030-01-01'),
        }),
      );
    });

    it('refuses stamping the other person as having seen it', async () => {
      await assertFails(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), {
          [`lastReadAt.${MADDIE}`]: serverTimestamp(),
        }),
      );
    });

    it('refuses an outsider stamping anything', async () => {
      await assertFails(
        updateDoc(
          doc(testEnv.authenticatedContext(OUTSIDER2).firestore(), 'conversations', 'chat-1'),
          { [`lastReadAt.${OUTSIDER2}`]: serverTimestamp() },
        ),
      );
    });
  });

  describe('deleting and muting a thread', () => {
    it('lets her delete it from her own inbox, clearing her badge', async () => {
      await assertSucceeds(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), {
          [`hiddenAt.${ELLA}`]: serverTimestamp(),
          [`unreadCounts.${ELLA}`]: 0,
        }),
      );
    });

    it('refuses a delete time she picked herself', async () => {
      await assertFails(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), {
          [`hiddenAt.${ELLA}`]: new Date('2030-01-01'),
        }),
      );
    });

    it('refuses deleting it from the other person’s inbox', async () => {
      await assertFails(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), {
          [`hiddenAt.${MADDIE}`]: serverTimestamp(),
        }),
      );
    });

    it('lets her mute and unmute it for herself', async () => {
      await assertSucceeds(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), { mutedUids: arrayUnion(ELLA) }),
      );
      await assertSucceeds(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), { mutedUids: arrayRemove(ELLA) }),
      );
    });

    it('refuses muting it for the other person', async () => {
      await assertFails(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), { mutedUids: arrayUnion(MADDIE) }),
      );
    });

    it('refuses an outsider muting it', async () => {
      await assertFails(
        updateDoc(
          doc(testEnv.authenticatedContext(OUTSIDER2).firestore(), 'conversations', 'chat-1'),
          { mutedUids: arrayUnion(OUTSIDER2) },
        ),
      );
    });

    it('refuses her setting her badge to anything but zero', async () => {
      await assertFails(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), {
          [`unreadCounts.${ELLA}`]: 5,
          mutedUids: arrayUnion(ELLA),
        }),
      );
    });

    it('refuses her marking herself as having replied', async () => {
      // Answering is what moves a request into the inbox, so only the
      // trigger may record it.
      await assertFails(
        updateDoc(doc(asElla(), 'conversations', 'chat-1'), { repliedUids: arrayUnion(ELLA) }),
      );
    });
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

describe('muting', () => {
  const mute = (db: Firestore, owner: string, other: string, data?: Record<string, unknown>) =>
    setDoc(
      doc(db, 'users', owner, 'muted', other),
      data ?? { mutedUid: other, createdAt: serverTimestamp() },
    );

  it('lets her mute someone, see her own list, and unmute', async () => {
    await assertSucceeds(mute(asElla(), ELLA, MADDIE));
    await assertSucceeds(getDoc(doc(asElla(), 'users', ELLA, 'muted', MADDIE)));
    await assertSucceeds(deleteDoc(doc(asElla(), 'users', ELLA, 'muted', MADDIE)));
  });

  it('keeps her mutes private — the muted person cannot see them', async () => {
    await assertSucceeds(mute(asElla(), ELLA, MADDIE));
    await assertFails(getDoc(doc(asMaddie(), 'users', ELLA, 'muted', MADDIE)));
  });

  it('refuses writing someone else’s mute list', async () => {
    await assertFails(mute(asMaddie(), ELLA, MADDIE));
  });

  it('refuses muting herself, a mismatched id, extra fields, or a made-up time', async () => {
    await assertFails(mute(asElla(), ELLA, ELLA));
    await assertFails(
      mute(asElla(), ELLA, MADDIE, { mutedUid: 'uid-other', createdAt: serverTimestamp() }),
    );
    await assertFails(
      mute(asElla(), ELLA, MADDIE, { mutedUid: MADDIE, createdAt: serverTimestamp(), note: 'x' }),
    );
    await assertFails(mute(asElla(), ELLA, MADDIE, { mutedUid: MADDIE, createdAt: new Date(0) }));
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
    await assertFails(setDoc(doc(asAdmin(), 'users', ELLA, 'adminNotes', 'note-2'), { note: 'x' }));
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
      createListingAs(ELLA, 'listing-sus', listingDoc(ELLA, { id: 'listing-sus' })),
    );
    await assertFails(
      sendAs(asElla(), 'chat-s', 'm-sus', {
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

  it('accepts a feed impression with its dwell time', async () => {
    await assertSucceeds(
      setDoc(
        doc(asElla(), 'events', 'event-impression'),
        goodEvent({
          type: 'post_impression',
          surface: 'feed',
          targetType: 'post',
          targetId: 'post-1',
          meta: { dwellMs: 2400, position: 3, tab: 'campus' },
        }),
      ),
    );
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
  it('lets a student read her own report status', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'reports', 'report-1'), {
        reporterUid: MADDIE,
        targetUid: ELLA,
        targetType: 'user',
        status: 'open',
      });
    });
    await assertSucceeds(getDoc(doc(asMaddie(), 'reports', 'report-1')));
  });

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

  it('stops the app writing reports directly', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'reports', 'report-2'), {
        reporterUid: ELLA,
        targetUid: MADDIE,
        targetType: 'user',
        status: 'open',
      }),
    );
  });
});

describe('support requests', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'supportRequests', 'support-1'), {
        id: 'support-1',
        campusId: CAMPUS,
        requesterUid: ELLA,
        topic: 'account_help',
        message: 'I need help.',
        status: 'open',
        resolvedAt: null,
        resolvedByUid: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  });

  it('lets a student read her own support submission', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'supportRequests', 'support-1')));
  });

  it('keeps support submissions hidden from other students', async () => {
    await assertFails(getDoc(doc(asMaddie(), 'supportRequests', 'support-1')));
  });

  it('lets admins read support submissions', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'supportRequests', 'support-1')));
  });

  it('stops the app writing support submissions directly', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'supportRequests', 'support-2'), {
        requesterUid: ELLA,
        topic: 'bug',
        message: 'Forged from the phone.',
        status: 'open',
      }),
    );
  });

  it('stops even an admin resolving one by hand', async () => {
    await assertFails(
      updateDoc(doc(asAdmin(), 'supportRequests', 'support-1'), { status: 'resolved' }),
    );
  });
});

describe('usernames', () => {
  it('cannot be claimed directly — only inside the signup transaction', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'usernames', 'stolen'), { username: 'stolen', uid: ELLA }),
    );
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

  it("refuses a comment signed with somebody else's name", async () => {
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
    await assertFails(updateDoc(doc(asAdmin(), 'comments', 'comment-1'), { status: 'suspended' }));
  });
});

describe('post counters', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'posts', 'post-s'), postDoc(ELLA));
    });
  });

  it('stops her inflating her own comment count', async () => {
    await assertFails(updateDoc(doc(asElla(), 'posts', 'post-s'), { 'stats.commentCount': 99 }));
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

  it('lets her dismiss her own profile checklist', async () => {
    // A preference about what she is shown, same category as
    // dismissedSuggestions below: no counter, no grant.
    await assertSucceeds(
      updateDoc(doc(asElla(), ...PRIVATE), {
        profileChecklist: { dismissed: true, foundFriendsAt: new Date() },
        updatedAt: new Date(),
      }),
    );
  });

  it("stops her touching someone else's checklist", async () => {
    await assertFails(
      updateDoc(doc(asMaddie(), 'users', ELLA, 'private', 'settings'), {
        profileChecklist: { dismissed: true, foundFriendsAt: null },
      }),
    );
  });

  it('stops her smuggling another field in alongside the checklist', async () => {
    // onlyChanges is the fence. A new allowed field must not become a
    // way to carry a forbidden one past it.
    await assertFails(
      updateDoc(doc(asElla(), ...PRIVATE), {
        profileChecklist: { dismissed: true, foundFriendsAt: null },
        campusEmail: 'ella@harvard.edu',
      }),
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

describe('try-ons', () => {
  /**
   * A try-on is a photograph of a student's body in somebody else's
   * dress. It is the most sensitive thing this app will ever hold.
   *
   * There is NO admin read rule, deliberately, and one of these tests
   * asserts its absence. If somebody later "fixes" that for a support
   * workflow, this test is what makes them say so out loud.
   */
  const TRYON = 'tryon-ella-1';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'tryOns', TRYON), {
        id: TRYON,
        uid: ELLA,
        bodyKind: 'preset',
        presetId: 'medium',
        pieces: [],
        imagePath: `users/${ELLA}/tryon/results/${TRYON}.jpg`,
        cacheKey: 'c'.repeat(64),
        saved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  });

  it('is readable by her', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'tryOns', TRYON)));
  });

  it('is NOT readable by another student', async () => {
    await assertFails(getDoc(doc(asMaddie(), 'tryOns', TRYON)));
  });

  it('is NOT readable by an admin', async () => {
    await assertFails(getDoc(doc(asAdmin(), 'tryOns', TRYON)));
  });

  it('lets her save a look', async () => {
    await assertSucceeds(
      updateDoc(doc(asElla(), 'tryOns', TRYON), { saved: true, updatedAt: serverTimestamp() }),
    );
  });

  it('lets her delete her own', async () => {
    await assertSucceeds(deleteDoc(doc(asElla(), 'tryOns', TRYON)));
  });

  it('stops her creating one', async () => {
    // The app inventing a try-on document is the app pointing at an
    // image it never paid for.
    await assertFails(
      setDoc(doc(asElla(), 'tryOns', 'forged'), {
        uid: ELLA,
        imagePath: `users/${ELLA}/tryon/results/forged.jpg`,
        saved: true,
      }),
    );
  });

  it('stops her repointing it at a different image', async () => {
    await assertFails(
      updateDoc(doc(asElla(), 'tryOns', TRYON), {
        imagePath: `users/${MADDIE}/tryon/results/x.jpg`,
      }),
    );
  });

  it('stops her rewriting the cache key', async () => {
    // The cache key is what decides whether we pay again. If she could
    // set it, she could point a key at any stored image.
    await assertFails(updateDoc(doc(asElla(), 'tryOns', TRYON), { cacheKey: 'd'.repeat(64) }));
  });

  it('stops another student saving or deleting hers', async () => {
    await assertFails(updateDoc(doc(asMaddie(), 'tryOns', TRYON), { saved: true }));
    await assertFails(deleteDoc(doc(asMaddie(), 'tryOns', TRYON)));
  });
});

describe('the try-on switch', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'config', 'tryOn'), {
        enabled: false,
        enabledForAdmins: true,
        updatedAt: new Date(),
        updatedBy: null,
      });
    });
  });

  it('is readable by a student, so the app can hide the feature', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'config', 'tryOn')));
  });

  it('cannot be switched on from a phone', async () => {
    // A switch that turns on spending is not flippable from a handset,
    // even an admin's. It goes through setTryOnConfig, which audits.
    await assertFails(updateDoc(doc(asElla(), 'config', 'tryOn'), { enabled: true }));
    await assertFails(updateDoc(doc(asAdmin(), 'config', 'tryOn'), { enabled: true }));
  });
});

describe('the switchboard (config/features)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'config', 'features'), {
        tryOn: false,
        tryOnAdminPreview: false,
        emailVerification: false,
        sameDay: true,
        payments: false,
      });
    });
  });

  it('is readable by a signed-in student, so the app can hide a feature', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'config', 'features')));
  });

  it('is not readable signed out', async () => {
    await assertFails(getDoc(doc(asStranger(), 'config', 'features')));
  });

  it('cannot be changed from any phone, admin included', async () => {
    // Every flip goes through setFeatureFlag, which audits and refuses
    // to turn on payments or email codes before they are set up.
    await assertFails(updateDoc(doc(asElla(), 'config', 'features'), { payments: true }));
    await assertFails(updateDoc(doc(asAdmin(), 'config', 'features'), { tryOn: true }));
    await assertFails(setDoc(doc(asAdmin(), 'config', 'features'), { sameDay: false }));
  });
});

describe("trending (the week's most-wanted pieces)", () => {
  const CAMPUS = 'university-of-south-carolina';
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'trending', CAMPUS), {
        campusId: CAMPUS,
        items: [{ listingId: 'l1', score: 8, people: 2 }],
        windowDays: 7,
      });
    });
  });

  it('is readable by a signed-in student', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'trending', CAMPUS)));
  });

  it('is not readable signed out', async () => {
    await assertFails(getDoc(doc(asStranger(), 'trending', CAMPUS)));
  });

  it('cannot be written from any phone, admin included', async () => {
    // Otherwise she could put her own piece at the top of Discover.
    const mine = { items: [{ listingId: 'mine', score: 999, people: 99 }] };
    await assertFails(updateDoc(doc(asElla(), 'trending', CAMPUS), mine));
    await assertFails(setDoc(doc(asElla(), 'trending', 'another-campus'), mine));
    await assertFails(updateDoc(doc(asAdmin(), 'trending', CAMPUS), mine));
  });
});

describe('phone hashes', () => {
  /**
   * The fence around contact matching. A student holding a phone
   * number must not be able to ask Firestore whether it belongs to a
   * Loane account — that is one guess at a time, and enough guesses is
   * the whole address book. Only matchContacts, which runs with admin
   * credentials and holds the pepper, may look.
   */
  const HASH = 'a'.repeat(64);

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'phoneHashes', HASH), {
        uid: MADDIE,
        createdAt: new Date(),
      });
    });
  });

  it('cannot be read by a student', async () => {
    await assertFails(getDoc(doc(asElla(), 'phoneHashes', HASH)));
  });

  it('cannot be read by an admin either — there is nothing there for a person', async () => {
    await assertFails(getDoc(doc(asAdmin(), 'phoneHashes', HASH)));
  });

  it('cannot be written by a student claiming a number is hers', async () => {
    await assertFails(
      setDoc(doc(asElla(), 'phoneHashes', 'b'.repeat(64)), {
        uid: ELLA,
        createdAt: new Date(),
      }),
    );
  });

  it('cannot be repointed at her own account', async () => {
    await assertFails(updateDoc(doc(asElla(), 'phoneHashes', HASH), { uid: ELLA }));
  });

  it('cannot be deleted by a student', async () => {
    await assertFails(deleteDoc(doc(asElla(), 'phoneHashes', HASH)));
  });
});

describe('dismissed suggestions', () => {
  // The one thing under users/ the app may write. It moves no counter
  // and changes only what she herself sees, so making her wait on a
  // Cloud Function to hide a card she just tapped X on would be slower
  // for no gain. These tests are the fence around that exception.
  it('lets her dismiss a suggested closet', async () => {
    await assertSucceeds(
      setDoc(doc(asElla(), 'users', ELLA, 'dismissedSuggestions', MADDIE), {
        createdAt: new Date(),
      }),
    );
  });

  it('lets her undo it', async () => {
    await assertSucceeds(deleteDoc(doc(asElla(), 'users', ELLA, 'dismissedSuggestions', MADDIE)));
  });

  it("stops her writing one into someone else's list", async () => {
    await assertFails(
      setDoc(doc(asElla(), 'users', MADDIE, 'dismissedSuggestions', ELLA), {
        createdAt: new Date(),
      }),
    );
  });

  it("stops her reading someone else's dismissals", async () => {
    // Who she has quietly hidden is nobody else's business.
    await assertFails(getDoc(doc(asElla(), 'users', MADDIE, 'dismissedSuggestions', ELLA)));
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

/**
 * C2 — the security-rules review. Every collection in firestore.rules
 * now has at least one test proving a student cannot read or write
 * what she should not. These are the ones that had none before; the
 * full map is in docs/security-rules-review.md.
 */
describe('security review — collections with no test before', () => {
  const NOSY = 'uid-nosy';
  const asNosy = () => testEnv.authenticatedContext(NOSY).firestore();

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', NOSY), userDoc(NOSY));
      await setDoc(doc(db, 'campuses', CAMPUS), { id: CAMPUS, domains: ['sc.edu'] });
      await setDoc(doc(db, 'legalDocs', 'terms-v1'), { version: 1, text: 'Terms' });
      await setDoc(doc(db, 'users', ELLA, 'blockedBy', MADDIE), { uid: MADDIE });
      await setDoc(doc(db, 'rateLimits', `createAccount__${ELLA}`), { count: 1 });
      await setDoc(doc(db, 'damageClaims', 'claim-1'), {
        id: 'claim-1',
        lenderUid: ELLA,
        renterUid: MADDIE,
        status: 'open',
        amountCents: 2500,
      });
      await setDoc(doc(db, 'circles', 'circle-1'), { id: 'circle-1', name: 'Tri Delt' });
      await setDoc(doc(db, 'circles', 'circle-1', 'members', ELLA), { uid: ELLA });
    });
  });

  it('lets anyone read the campus list but nobody change it', async () => {
    // Signup needs the approved email domains before there is an account.
    await assertSucceeds(getDoc(doc(asStranger(), 'campuses', CAMPUS)));
    await assertFails(updateDoc(doc(asElla(), 'campuses', CAMPUS), { domains: ['gmail.com'] }));
    await assertFails(updateDoc(doc(asAdmin(), 'campuses', CAMPUS), { domains: ['gmail.com'] }));
    await assertFails(setDoc(doc(asElla(), 'campuses', 'fake-school'), { domains: ['x.edu'] }));
  });

  it('lets anyone read published Terms but nobody rewrite them', async () => {
    await assertSucceeds(getDoc(doc(asStranger(), 'legalDocs', 'terms-v1')));
    await assertFails(updateDoc(doc(asElla(), 'legalDocs', 'terms-v1'), { text: 'new' }));
    await assertFails(updateDoc(doc(asAdmin(), 'legalDocs', 'terms-v1'), { text: 'new' }));
    await assertFails(deleteDoc(doc(asAdmin(), 'legalDocs', 'terms-v1')));
  });

  it('shows "who blocked me" only to her, and lets nobody write it', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'users', ELLA, 'blockedBy', MADDIE)));
    await assertFails(getDoc(doc(asNosy(), 'users', ELLA, 'blockedBy', MADDIE)));
    // She cannot erase a block against her, and nobody can fake one.
    await assertFails(deleteDoc(doc(asElla(), 'users', ELLA, 'blockedBy', MADDIE)));
    await assertFails(setDoc(doc(asMaddie(), 'users', ELLA, 'blockedBy', NOSY), { uid: NOSY }));
  });

  it('seals the server rate-limit counters shut, even from their owner', async () => {
    const ref = (db: Firestore) => doc(db, 'rateLimits', `createAccount__${ELLA}`);
    await assertFails(getDoc(ref(asElla())));
    await assertFails(updateDoc(ref(asElla()), { count: 0 }));
    await assertFails(deleteDoc(ref(asElla())));
    await assertFails(getDoc(ref(asAdmin())));
  });

  it('shows a damage claim only to the two people in it, and lets nobody edit it', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'damageClaims', 'claim-1')));
    await assertSucceeds(getDoc(doc(asMaddie(), 'damageClaims', 'claim-1')));
    await assertSucceeds(getDoc(doc(asAdmin(), 'damageClaims', 'claim-1')));
    await assertFails(getDoc(doc(asNosy(), 'damageClaims', 'claim-1')));
    // Money: only a Cloud Function, after an admin approves.
    await assertFails(updateDoc(doc(asElla(), 'damageClaims', 'claim-1'), { amountCents: 99999 }));
    await assertFails(updateDoc(doc(asMaddie(), 'damageClaims', 'claim-1'), { status: 'denied' }));
    await assertFails(
      setDoc(doc(asElla(), 'damageClaims', 'claim-2'), {
        lenderUid: ELLA,
        renterUid: MADDIE,
        amountCents: 5000,
      }),
    );
  });

  it('stops a student filing a report or a support request straight into the database', async () => {
    // Both go through Cloud Functions so they are rate-limited and
    // the reporter's name is stamped by the server, not the phone.
    await assertFails(
      setDoc(doc(asElla(), 'supportRequests', 'sr-x'), { requesterUid: ELLA, message: 'hi' }),
    );
    await assertFails(
      setDoc(doc(asElla(), 'reports', 'r-x'), { reporterUid: MADDIE, targetUid: NOSY }),
    );
  });

  it('keeps circles read-only until they are built', async () => {
    await assertSucceeds(getDoc(doc(asElla(), 'circles', 'circle-1')));
    await assertFails(getDoc(doc(asStranger(), 'circles', 'circle-1')));
    await assertFails(setDoc(doc(asNosy(), 'circles', 'circle-1', 'members', NOSY), { uid: NOSY }));
    await assertFails(updateDoc(doc(asElla(), 'circles', 'circle-1'), { name: 'Mine' }));
  });

  it('refuses any collection nobody named in the rules', async () => {
    // New collections must be opened on purpose, never by accident.
    await assertFails(setDoc(doc(asElla(), 'somethingNew', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(asAdmin(), 'somethingNew', 'x')));
  });

  it('keeps her activity alerts from other students', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ELLA, 'notifications', 'n-1'), {
        type: 'like',
        readAt: null,
      });
    });
    await assertFails(getDoc(doc(asNosy(), 'users', ELLA, 'notifications', 'n-1')));
    await assertFails(
      updateDoc(doc(asNosy(), 'users', ELLA, 'notifications', 'n-1'), { readAt: serverTimestamp() }),
    );
  });

  it('never lets a student see someone else’s rental', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'bookings', 'b-review'), {
        id: 'b-review',
        lenderUid: ELLA,
        renterUid: MADDIE,
        participantUids: [ELLA, MADDIE],
        status: 'requested',
      });
    });
    await assertFails(getDoc(doc(asNosy(), 'bookings', 'b-review')));
    await assertSucceeds(getDoc(doc(asElla(), 'bookings', 'b-review')));
  });
});
