/**
 * The whole core flow, against a REAL project, driven the way the app
 * drives it.
 *
 * smokeTestLive.ts answers "is the backend up?" — sign-up, a callable,
 * a guard that refuses. This answers the bigger question: can two
 * students actually complete a rental? It walks sign-up, profile,
 * listing, post, tag, request, accept, chat, handoff, return,
 * completion, reviews, decline, cancel and expiry.
 *
 * WHY THIS IS COMMITTED. The hourly sweep crashed on a missing index
 * from the day it was deployed and nothing noticed for weeks, because
 * everything works on an emulator that does not enforce indexes. This
 * script is what would have caught it the same afternoon. Run it after
 * every deploy that touches functions, rules or indexes.
 *
 * IT CLEANS UP AFTER ITSELF. Two throwaway students and one throwaway
 * admin, all deleted at the end along with everything they made. If it
 * dies halfway the wreckage is deliberately left behind — better a
 * stray row you can see than a silent delete of something real — and
 * re-running from a clean tree clears it.
 *
 *   npx tsx scripts/coreFlowLive.ts --project loane-code
 */

import { initializeApp as adminInit, applicationDefault } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb, Timestamp } from 'firebase-admin/firestore';
import { getStorage as adminStorage } from 'firebase-admin/storage';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const projectId = arg('project');
if (!projectId || projectId.startsWith('demo-')) {
  console.error('Pass --project <real project id>. Use the emulator seed for demo-loane.');
  process.exit(1);
}
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Refusing: an emulator host is set, so this would not test the real thing.');
  process.exit(1);
}

/**
 * The web config. Not a secret — it identifies the project, and the
 * security rules are what grant access. See docs/security.md.
 */
const WEB = {
  apiKey: 'AIzaSyAL5iE73tRc9YbY7jGWya65Q8Pl_Kd831M',
  authDomain: 'loane-code.firebaseapp.com',
  projectId: 'loane-code',
  storageBucket: 'loane-code.firebasestorage.app',
  appId: '1:384488190763:web:13e9baa2efd0b10815cb6e',
};

adminInit({
  credential: applicationDefault(),
  projectId,
  storageBucket: `${projectId}.firebasestorage.app`,
});
const admin = adminDb();

const stamp = Date.now().toString(36);
const LENDER = `cfl${stamp}`;
const RENTER = `cfr${stamp}`;
const ADMIN_EMAIL = `cfadmin${stamp}@joinloane.com`;
const ADMIN_PASSWORD = `Tt${stamp}!aZ9q`;

/** A real, tiny JPEG. Storage rules check the content type. */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
    'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

let passed = 0;
const failures: { step: string; why: string }[] = [];

async function step(name: string, fn: () => Promise<string | void>): Promise<void> {
  try {
    const detail = await fn();
    passed += 1;
    console.warn(`  PASS  ${name}${detail ? '  — ' + detail : ''}`);
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    failures.push({ step: name, why });
    console.warn(`  FAIL  ${name}  — ${why}`);
  }
}

function isoIn(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Student {
  uid: string;
  campusId: string;
  username: string;
  db: ReturnType<typeof getFirestore>;
  storage: ReturnType<typeof getStorage>;
  call: (name: string) => ReturnType<typeof httpsCallable>;
}

async function signUp(appName: string, username: string): Promise<Student> {
  const app = initializeApp(WEB, appName);
  const fns = getFunctions(app, 'us-central1');
  const r = (await httpsCallable(fns, 'createAccount')({
    firstName: username.slice(0, 10),
    email: `${username}@email.sc.edu`,
    password: 'loane1234',
    username,
  })) as { data: { uid: string; token: string; campusId: string } };
  await signInWithCustomToken(getAuth(app), r.data.token);
  return {
    uid: r.data.uid,
    campusId: r.data.campusId,
    username,
    db: getFirestore(app),
    storage: getStorage(app),
    call: (name) => httpsCallable(fns, name),
  };
}

async function upload(student: Student, path: string) {
  const target = ref(student.storage, path);
  await uploadBytes(target, JPEG, { contentType: 'image/jpeg' });
  return { path, url: await getDownloadURL(target), width: 800, height: 1000, bytes: 1000 };
}

const listings: string[] = [];
const posts: string[] = [];
const bookings: string[] = [];

async function main(): Promise<void> {
  console.warn(`Core flow against ${projectId}\n`);

  let lender!: Student;
  let renter!: Student;
  let listingId = '';
  let postId = '';
  let bookingId = '';
  let conversationId = '';
  let adminUid = '';

  await step('sign up two students', async () => {
    lender = await signUp(`cf-lender-${stamp}`, LENDER);
    renter = await signUp(`cf-renter-${stamp}`, RENTER);
    return `${LENDER} + ${RENTER}`;
  });

  await step('a non-school email is refused', async () => {
    const r = (await lender.call('checkCampusEmail')({ email: 'someone@gmail.com' })) as {
      data: { allowed: boolean };
    };
    if (r.data.allowed) throw new Error('a gmail address was accepted');
  });

  await step('edit profile and upload a photo', async () => {
    const photo = await upload(lender, `users/${lender.uid}/profile/avatar-${Date.now()}.jpg`);
    await updateDoc(doc(lender.db, 'users', lender.uid), {
      displayName: 'Core Lender',
      bio: 'core flow',
      sizes: { tops: 'S', bottoms: 'S', dresses: 'S', shoe: '7.5' },
      showSizes: true,
      photoUrl: photo.url,
      updatedAt: serverTimestamp(),
    });
    const after = await getDoc(doc(lender.db, 'users', lender.uid));
    if ((after.data() as { displayName: string }).displayName !== 'Core Lender') {
      throw new Error('the profile did not save');
    }
  });

  const listingBody = (
    id: string,
    photo: Awaited<ReturnType<typeof upload>>,
    status: string,
  ) => ({
    id,
    campusId: lender.campusId,
    ownerUid: lender.uid,
    owner: {
      uid: lender.uid,
      username: LENDER,
      displayName: 'Core Lender',
      photoUrl: null,
      campusId: lender.campusId,
      isVerified: true,
    },
    name: 'Core flow dress',
    description: 'a garment for the end to end check',
    brand: null,
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    condition: 'like_new',
    occasions: ['formal'],
    colorNames: [],
    photos: [photo],
    coverUrl: photo.url,
    intent: 'rent',
    status,
    pricing: { threeDayCents: 2000, sevenDayCents: 2500 },
    salePriceCents: null,
    garmentValueCents: 5900,
    requiresApproval: true,
    blackoutDates: [],
    suspendedReason: null,
    removedAt: null,
    stats: { viewCount: 0, saveCount: 0, tagCount: 0, completedRentals: 0 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Both toggle states: "Available now" off writes status paused, which
  // the create rule refused for weeks while the app blamed her wifi.
  for (const status of ['active', 'paused']) {
    await step(`add to closet — Available now ${status === 'active' ? 'ON' : 'OFF'}`, async () => {
      const listingRef = doc(collection(lender.db, 'listings'));
      const photo = await upload(lender, `users/${lender.uid}/listings/${listingRef.id}/0.jpg`);
      await setDoc(listingRef, listingBody(listingRef.id, photo, status));
      listings.push(listingRef.id);
      if (status === 'active') listingId = listingRef.id;
      return listingRef.id;
    });
  }

  await step('post a look with the piece tagged', async () => {
    const photo = await upload(lender, `users/${lender.uid}/posts/draft-${Date.now()}/0.jpg`);
    const r = (await lender.call('createPost')({
      photos: [{ ...photo, tags: [{ x: 0.5, y: 0.6, listingId, ownerUid: lender.uid }] }],
      caption: 'core flow look',
      occasions: ['formal'],
    })) as { data: { postId: string } };
    postId = r.data.postId;
    posts.push(postId);
    const saved = await admin.collection('posts').doc(postId).get();
    if (!((saved.data() as { taggedListingIds: string[] }).taggedListingIds ?? []).includes(listingId)) {
      throw new Error('the tag did not reach the post');
    }
  });

  await step('the other student sees it and opens the listing', async () => {
    const feed = await getDocs(
      query(
        collection(renter.db, 'posts'),
        where('campusId', '==', renter.campusId),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(20),
      ),
    );
    if (!feed.docs.some((d) => d.id === postId)) throw new Error('post missing from the feed');
    const l = await getDoc(doc(renter.db, 'listings', listingId));
    if (!l.exists()) throw new Error('listing not readable by another student');
  });

  await step('she requests it', async () => {
    const r = (await renter.call('requestBooking')({
      listingId,
      startDate: isoIn(5),
      endDate: isoIn(8),
      message: 'for a formal',
    })) as { data: { bookingId: string; status: string } };
    bookingId = r.data.bookingId;
    bookings.push(bookingId);
    return r.data.status;
  });

  await step('the lender is told', async () => {
    const n = await admin
      .collection('users').doc(lender.uid).collection('notifications')
      .where('type', '==', 'rental_requested').get();
    if (n.empty) throw new Error('no notification reached the lender');
  });

  await step('it shows in her Lending list', async () => {
    const mine = await getDocs(
      query(
        collection(lender.db, 'bookings'),
        where('lenderUid', '==', lender.uid),
        orderBy('createdAt', 'desc'),
      ),
    );
    if (!mine.docs.some((d) => d.id === bookingId)) throw new Error('missing from the lending query');
  });

  await step('the lender accepts', async () => {
    const r = (await lender.call('respondToBooking')({ bookingId, accept: true })) as {
      data: { status: string };
    };
    return r.data.status;
  });

  await step('the renter is told it was accepted', async () => {
    const n = await admin
      .collection('users').doc(renter.uid).collection('notifications')
      .where('type', 'in', ['rental_accepted', 'booking_confirmed']).get();
    if (n.empty) throw new Error('no notification reached the renter');
  });

  await step('they message each other', async () => {
    const r = (await renter.call('openConversation')({
      withUid: lender.uid,
      listingId,
      bookingId,
    })) as { data: { conversationId: string } };
    conversationId = r.data.conversationId;
    for (const [who, body] of [
      [renter, 'where should we meet?'],
      [lender, 'russell house at 4'],
    ] as [Student, string][]) {
      await setDoc(doc(collection(who.db, 'conversations', conversationId, 'messages')), {
        conversationId,
        senderUid: who.uid,
        body,
        photo: null,
        sharedPost: null,
        readBy: [who.uid],
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    const msgs = await admin
      .collection('conversations').doc(conversationId).collection('messages').get();
    if (msgs.size < 2) throw new Error(`only ${msgs.size} messages landed`);
  });

  await step('dropoff, receipt, return', async () => {
    const photo = await upload(lender, `users/${lender.uid}/bookings/${bookingId}/drop.jpg`);
    await lender.call('recordDropoff')({ bookingId, photos: [photo], notes: 'handed over' });
    await renter.call('confirmReceipt')({ bookingId });
    await renter.call('confirmReturn')({ bookingId });
    const b = await admin.collection('bookings').doc(bookingId).get();
    const status = (b.data() as { status: string }).status;
    if (status !== 'returned') throw new Error(`expected returned, got ${status}`);
  });

  await step('the lender confirms and it completes on the spot', async () => {
    await lender.call('confirmReturn')({ bookingId });
    const b = await admin.collection('bookings').doc(bookingId).get();
    const d = b.data() as { status: string; handoff: Record<string, unknown> };
    if (d.status !== 'completed') throw new Error(`expected completed, got ${d.status}`);
    if (!d.handoff.lenderConfirmedReturnAt) throw new Error('lenderConfirmedReturnAt was not set');
    const asked = await Promise.all(
      [lender.uid, renter.uid].map(async (uid) =>
        (await admin.collection('users').doc(uid).collection('notifications')
          .where('type', '==', 'review_requested').get()).size,
      ),
    );
    if (!asked[0] || !asked[1]) throw new Error(`review prompts: ${asked.join(' / ')}`);
    return 'both prompted for a review';
  });

  await step('both leave a review and the rating moves', async () => {
    await renter.call('writeReview')({ bookingId, rating: 5, body: 'lovely dress' });
    await lender.call('writeReview')({ bookingId, rating: 5, body: 'looked after it' });
    const l = await admin.collection('users').doc(lender.uid).get();
    const stats = (l.data() as { stats: { ratingCount: number; ratingAverage: number } }).stats;
    if (!stats.ratingCount) throw new Error('the rating did not move');
    return `${stats.ratingAverage} from ${stats.ratingCount}`;
  });

  async function freshRequest(offset: number): Promise<string> {
    const r = (await renter.call('requestBooking')({
      listingId,
      startDate: isoIn(offset),
      endDate: isoIn(offset + 3),
    })) as { data: { bookingId: string } };
    bookings.push(r.data.bookingId);
    return r.data.bookingId;
  }

  await step('a request can be declined', async () => {
    const id = await freshRequest(20);
    await lender.call('respondToBooking')({ bookingId: id, accept: false, reason: 'promised it' });
    const b = await admin.collection('bookings').doc(id).get();
    if ((b.data() as { status: string }).status !== 'declined') throw new Error('not declined');
  });

  await step('a request can be cancelled', async () => {
    const id = await freshRequest(30);
    await renter.call('cancelBooking')({ bookingId: id, reason: 'found something else' });
    const b = await admin.collection('bookings').doc(id).get();
    if ((b.data() as { status: string }).status !== 'cancelled') throw new Error('not cancelled');
  });

  await step('the sweep runs clean and expires an old request', async () => {
    const id = await freshRequest(40);
    await admin.collection('bookings').doc(id).update({
      expiresAt: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    });

    const record = await adminAuth().createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      emailVerified: true,
    });
    adminUid = record.uid;
    await adminAuth().setCustomUserClaims(record.uid, { admin: true });

    const adminApp = initializeApp(WEB, `cf-admin-${stamp}`);
    await signInWithEmailAndPassword(getAuth(adminApp), ADMIN_EMAIL, ADMIN_PASSWORD);
    // Deliberately NOT swallowed. The sweep throwing is how the missing
    // notifications index hid for weeks.
    const r = (await httpsCallable(getFunctions(adminApp, 'us-central1'), 'runBookingSweep')({})) as {
      data: Record<string, number>;
    };

    const b = await admin.collection('bookings').doc(id).get();
    if ((b.data() as { status: string }).status !== 'declined') throw new Error('did not expire');
    return JSON.stringify(r.data);
  });

  // --- clean up ---------------------------------------------------------
  console.warn('\nCleaning up');
  for (const id of bookings) await admin.collection('bookings').doc(id).delete().catch(() => {});
  for (const id of listings) await admin.collection('listings').doc(id).delete().catch(() => {});
  for (const id of posts) await admin.collection('posts').doc(id).delete().catch(() => {});
  if (conversationId) {
    const msgs = await admin
      .collection('conversations').doc(conversationId).collection('messages').get();
    for (const m of msgs.docs) await m.ref.delete();
    await admin.collection('conversations').doc(conversationId).delete().catch(() => {});
  }
  for (const uid of [lender?.uid, renter?.uid].filter(Boolean) as string[]) {
    for (const sub of ['notifications', 'private', 'blocked']) {
      const s = await admin.collection('users').doc(uid).collection(sub).get();
      for (const d of s.docs) await d.ref.delete();
    }
    const [files] = await adminStorage().bucket().getFiles({ prefix: `users/${uid}/` });
    for (const f of files) await f.delete().catch(() => {});
    for (const [c, field] of [
      ['reviews', 'authorUid'], ['reviews', 'subjectUid'], ['events', 'uid'],
      ['likes', 'uid'], ['postSaves', 'uid'], ['saves', 'uid'], ['follows', 'followerUid'],
    ] as [string, string][]) {
      const q = await admin.collection(c).where(field, '==', uid).get().catch(() => null);
      if (q) for (const d of q.docs) await d.ref.delete();
    }
    await admin.collection('users').doc(uid).delete().catch(() => {});
    await adminAuth().deleteUser(uid).catch(() => {});
  }
  for (const u of [LENDER, RENTER]) {
    await admin.collection('usernames').doc(u).delete().catch(() => {});
  }
  if (adminUid) await adminAuth().deleteUser(adminUid).catch(() => {});

  console.warn(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.warn('\nFAILURES');
    for (const f of failures) console.warn(`  ${f.step}\n    ${f.why}`);
  }
}

main()
  .then(() => process.exit(failures.length > 0 ? 1 : 0))
  .catch((error: unknown) => {
    console.error('\nThe harness itself crashed. Test data may be left behind:', error);
    process.exit(1);
  });
