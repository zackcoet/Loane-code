/**
 * The content filter files a report on a match, and only on a match.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUTO_FILTER_REPORTER_UID, COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane-autoflag';

let app: App;
let db: Firestore;
let queueAutoFlag: typeof import('../moderation/autoFlag').queueAutoFlag;
/** The functions' own Firestore, so the batch and the report share an app. */
let newBatch: () => ReturnType<Firestore['batch']>;

const BASE = {
  targetType: 'comment' as const,
  targetId: 'comment-1',
  targetUid: 'uid-sender',
  campusId: 'university-of-south-carolina',
};

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT }, 'autoflag-tests');
  db = getFirestore(app);
  ({ queueAutoFlag } = await import('../moderation/autoFlag'));
  const admin = await import('../lib/admin');
  newBatch = () => admin.db().batch();
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection(COLLECTIONS.reports));
});

describe('queueAutoFlag', () => {
  it('files an open report with the words copied in', async () => {
    const batch = newBatch();
    expect(queueAutoFlag(batch, { ...BASE, text: 'just kys' })).toBe(true);
    await batch.commit();

    const reports = await db.collection(COLLECTIONS.reports).get();
    expect(reports.size).toBe(1);
    const report = reports.docs[0]!.data();
    expect(report.reporterUid).toBe(AUTO_FILTER_REPORTER_UID);
    expect(report.status).toBe('open');
    expect(report.snapshot).toBe('just kys');
    expect(report.details).toContain('kys');
  });

  it('files nothing for ordinary words', async () => {
    const batch = newBatch();
    expect(queueAutoFlag(batch, { ...BASE, text: 'Love this for gameday!' })).toBe(false);
    await batch.commit();
    expect((await db.collection(COLLECTIONS.reports).get()).empty).toBe(true);
  });

  it('files one report even if the same content is checked twice', async () => {
    for (let i = 0; i < 2; i += 1) {
      const batch = newBatch();
      queueAutoFlag(batch, { ...BASE, targetType: 'message', targetId: 'c1/m1', text: 'kys' });
      await batch.commit();
    }
    expect((await db.collection(COLLECTIONS.reports).get()).size).toBe(1);
  });
});
