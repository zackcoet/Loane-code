/**
 * "Download my data" against the emulator.
 *
 *   - She gets her own things, both sides of her rentals and chats.
 *   - The hashed sign-up code and admin notes are left out.
 *   - Somebody else's things are not in her file.
 *   - Only an admin, with a reason, can export another student, and it
 *     leaves an audit row.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const ELLA = 'uid-ella-export';
const HARPER = 'uid-harper-export';
const ADMIN = 'uid-admin-export';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let exportMine: (req: CallableRequest<any>) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let exportAsAdmin: (req: CallableRequest<any>) => Promise<any>;

function as(uid: string, admin: boolean, data: unknown): CallableRequest<unknown> {
  return { auth: { uid, token: { admin } }, data } as unknown as CallableRequest<unknown>;
}

async function attempt(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'ok';
  } catch (error) {
    return (error as { message?: string }).message ?? 'error';
  }
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../privacy/exportUserData');
  exportMine = (req) => mod.exportMyData.run(req);
  exportAsAdmin = (req) => mod.adminExportUserData.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.users,
    COLLECTIONS.listings,
    COLLECTIONS.bookings,
    COLLECTIONS.conversations,
    COLLECTIONS.reports,
    COLLECTIONS.adminActions,
    COLLECTIONS.rateLimits,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`users/${ELLA}`).set({ uid: ELLA, username: 'ellaexport', createdAt: new Date() });
  await db.doc(`users/${HARPER}`).set({ uid: HARPER, username: 'harperexport' });
  await db.doc(`users/${ELLA}/private/settings`).set({ phone: '+18035550100' });
  await db.doc(`users/${ELLA}/private/verification`).set({ codeHash: 'secret' });
  await db.doc(`users/${ELLA}/adminNotes/n1`).set({ text: 'internal' });

  await db.doc('listings/ella-dress').set({ ownerUid: ELLA, name: 'Red dress' });
  await db.doc('listings/harper-top').set({ ownerUid: HARPER, name: 'Blue top' });
  await db.doc('bookings/b1').set({ renterUid: HARPER, lenderUid: ELLA, listingId: 'ella-dress' });
  await db.doc(`conversations/${ELLA}_${HARPER}`).set({ participantUids: [ELLA, HARPER] });
  await db
    .doc(`conversations/${ELLA}_${HARPER}/messages/m1`)
    .set({ senderUid: HARPER, text: 'hi' });
  await db.doc('reports/r1').set({
    reporterUid: ELLA,
    resolution: { adminUid: ADMIN, action: 'none', notes: 'private', resolvedAt: null },
  });
});

describe('exportMyData', () => {
  it('needs her signed in', async () => {
    expect(await attempt(() => exportMine({ data: undefined } as CallableRequest))).not.toBe('ok');
  });

  it('gives her her own things, and nobody else’s', async () => {
    const data = await exportMine(as(ELLA, false, undefined));

    expect(data.uid).toBe(ELLA);
    expect(data.profile.username).toBe('ellaexport');
    expect(typeof data.profile.createdAt).toBe('string');
    expect(data.listings.map((l: { id: string }) => l.id)).toEqual(['ella-dress']);
    expect(data.rentalsAsLender).toHaveLength(1);
    expect(data.conversations[0].messages[0].text).toBe('hi');
    expect(data.privateSettings.map((d: { id: string }) => d.id)).toEqual(['settings']);
    expect(JSON.stringify(data)).not.toContain('secret');
    expect(JSON.stringify(data)).not.toContain('internal');
    expect(data.reportsFiled[0].resolution).toEqual({ action: 'none', resolvedAt: null });
  });

  it('is limited to a few a day', async () => {
    for (let i = 0; i < 3; i++) await exportMine(as(ELLA, false, undefined));
    expect(await attempt(() => exportMine(as(ELLA, false, undefined)))).toMatch(/tomorrow/);
  });
});

describe('adminExportUserData', () => {
  it('refuses a student exporting somebody else', async () => {
    expect(
      await attempt(() => exportAsAdmin(as(HARPER, false, { uid: ELLA, reason: 'curious' }))),
    ).toMatch(/Admins only/);
  });

  it('needs a reason, and leaves an audit row', async () => {
    expect(await attempt(() => exportAsAdmin(as(ADMIN, true, { uid: ELLA })))).toMatch(/Why/);

    const data = await exportAsAdmin(as(ADMIN, true, { uid: ELLA, reason: 'privacy request' }));
    expect(data.uid).toBe(ELLA);

    const audit = await db.collection(COLLECTIONS.adminActions).get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0]!.data()).toMatchObject({
      action: 'user_data_exported',
      targetId: ELLA,
      notes: 'privacy request',
    });
  });

  it('says so for a uid that does not exist', async () => {
    expect(
      await attempt(() => exportAsAdmin(as(ADMIN, true, { uid: 'nobody', reason: 'x' }))),
    ).toMatch(/No student/);
  });
});
