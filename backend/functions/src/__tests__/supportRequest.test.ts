/**
 * "Contact us" in Help, against the emulator.
 *
 *   - A good message lands in the help queue with who sent it.
 *   - A missing topic, an empty, too-long or non-text message is refused
 *     clearly — and doesn't use up one of her sends.
 *   - Nobody can flood the queue: ten a day.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, LIMITS as FIELD_LIMITS, SUPPORT_TOPICS } from '@loane/shared';
import { LIMITS } from '../lib/rateLimit';

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const ME = 'uid-me-support';
const TOPIC = SUPPORT_TOPICS[0];

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let submit: (req: CallableRequest<any>) => Promise<{ requestId: string }>;

function as(uid: string, data: unknown): CallableRequest<unknown> {
  return { auth: { uid, token: {} }, data } as unknown as CallableRequest<unknown>;
}

async function attempt(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'ok';
  } catch (error) {
    return (error as { message?: string }).message ?? 'error';
  }
}

async function queued() {
  return (await db.collection(COLLECTIONS.supportRequests).get()).size;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../support/contact');
  submit = (req) => mod.submitSupportRequest.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [COLLECTIONS.users, COLLECTIONS.supportRequests, COLLECTIONS.rateLimits]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${ME}`).set({
    uid: ME,
    username: 'mesupport',
    displayName: 'Me',
    photoUrl: null,
    campusId: CAMPUS,
    isVerified: true,
    status: 'active',
  });
});

describe('submitSupportRequest', () => {
  it('puts a good message in the help queue, trimmed, with who sent it', async () => {
    const { requestId } = await submit(
      as(ME, { topic: TOPIC, message: '   I cannot change my photo   ' }),
    );
    const row = (await db.doc(`${COLLECTIONS.supportRequests}/${requestId}`).get()).data();
    expect(row?.message).toBe('I cannot change my photo');
    expect(row?.requesterUid).toBe(ME);
    expect(row?.requester.username).toBe('mesupport');
    expect(row?.status).toBe('open');
    expect(row?.campusId).toBe(CAMPUS);
  });

  it('refuses a missing topic and a bad message, clearly', async () => {
    expect(
      await attempt(() => submit(as(ME, { topic: 'free_money', message: 'hello there' }))),
    ).toMatch(/Pick a topic/);
    expect(await attempt(() => submit(as(ME, { topic: TOPIC, message: '   ' })))).toMatch(
      /what you need help with/,
    );
    expect(await attempt(() => submit(as(ME, { topic: TOPIC, message: 12345 })))).toMatch(
      /what you need help with/,
    );
    const tooLong = 'a'.repeat(FIELD_LIMITS.supportMessage.max + 1);
    expect(await attempt(() => submit(as(ME, { topic: TOPIC, message: tooLong })))).toMatch(
      /too long/,
    );
    expect(await queued()).toBe(0);
  });

  it('caps sends at ten a day, and refused ones never count', async () => {
    // A few typos first — these must not use up her sends.
    for (let i = 0; i < 3; i += 1) {
      await attempt(() => submit(as(ME, { topic: TOPIC, message: '' })));
    }
    for (let i = 0; i < LIMITS.support.max; i += 1) {
      await submit(as(ME, { topic: TOPIC, message: `Still need help, try ${i}` }));
    }
    expect(await queued()).toBe(LIMITS.support.max);
    expect(await attempt(() => submit(as(ME, { topic: TOPIC, message: 'One more please' })))).toBe(
      LIMITS.support.message,
    );
    expect(await queued()).toBe(LIMITS.support.max);
  });
});
