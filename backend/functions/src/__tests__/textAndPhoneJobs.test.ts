/**
 * The background jobs that check edited text and keep contact matching
 * in step — against the emulator.
 *
 *   flagEditedCaption / flagListingText / flagProfileText: an edit that
 *   matches the word list files one report (one, even if the job runs
 *   twice); a clean edit, or a save that changed no text, files none.
 *
 *   syncPhoneHash: she holds the hash of the number saved NOW, whatever
 *   order two quick edits are handled in; letting go of a number only
 *   takes her off it; a number two accounts both saved matches neither.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, SUBCOLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const ELLA = 'uid-ella-textjobs';
const ANNA = 'uid-anna-textjobs';
const BAD = 'cute top, go die';

type Run = (event: unknown) => Promise<unknown>;
let app: App;
let db: Firestore;
let captionJob: Run;
let listingJob: Run;
let profileJob: Run;
let phoneJob: Run;
let storedHash: (e164: string) => string;

function changed(id: string, params: Record<string, string>, before: unknown, after: unknown) {
  return {
    id,
    params,
    data: {
      before: { exists: before !== undefined, data: () => before },
      after: { exists: after !== undefined, data: () => after },
    },
  };
}

async function reports() {
  return (await db.collection(COLLECTIONS.reports).get()).docs.map((d) => d.data());
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  // The pepper's fixed development value — see lib/phoneHash.ts.
  process.env.FUNCTIONS_EMULATOR = 'true';
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const c = await import('../triggers/flagEditedCaption');
  const t = await import('../triggers/flagProfileAndListingText');
  const p = await import('../triggers/syncPhoneHash');
  captionJob = (ev) => c.flagEditedCaption.run(ev as never);
  listingJob = (ev) => t.flagListingText.run(ev as never);
  profileJob = (ev) => t.flagProfileText.run(ev as never);
  phoneJob = (ev) => p.syncPhoneHash.run(ev as never);
  storedHash = (await import('../lib/phoneHash')).storedPhoneHashFromE164;
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [COLLECTIONS.reports, COLLECTIONS.phoneHashes, COLLECTIONS.users]) {
    await db.recursiveDelete(db.collection(c));
  }
});

describe('the word filter on edits', () => {
  const post = { authorUid: ELLA, campusId: CAMPUS, caption: 'gameday fit', likeCount: 0 };
  const piece = { ownerUid: ELLA, campusId: CAMPUS, name: 'Red mini', description: 'Worn once' };
  const profile = { uid: ELLA, campusId: CAMPUS, displayName: 'Ella', bio: '' };

  it('files one report for an edited caption that matches, even if run twice', async () => {
    const ev = changed('ev-1', { postId: 'post-1' }, post, { ...post, caption: BAD });
    await captionJob(ev);
    await captionJob(ev);
    const filed = await reports();
    expect(filed).toHaveLength(1);
    expect(filed[0]).toMatchObject({
      id: 'auto_post_post-1_edit_ev-1',
      targetType: 'post',
      targetId: 'post-1',
      targetUid: ELLA,
      campusId: CAMPUS,
      snapshot: BAD,
      status: 'open',
    });
  });

  it('files nothing for a clean caption, or a save that left the caption alone', async () => {
    await captionJob(changed('ev-2', { postId: 'post-1' }, post, { ...post, caption: 'formal' }));
    // A like moves the counter, not the caption — even if the caption is bad.
    const badPost = { ...post, caption: BAD };
    await captionJob(changed('ev-3', { postId: 'post-1' }, badPost, { ...badPost, likeCount: 1 }));
    expect(await reports()).toHaveLength(0);
  });

  it('checks a new piece and an edited description, not a price change', async () => {
    await listingJob(changed('ev-4', { listingId: 'piece-1' }, undefined, { ...piece, name: BAD }));
    await listingJob(
      changed('ev-5', { listingId: 'piece-1' }, piece, { ...piece, description: 'kys' }),
    );
    const badPiece = { ...piece, description: 'kys' };
    await listingJob(
      changed('ev-6', { listingId: 'piece-1' }, badPiece, { ...badPiece, price: 3000 }),
    );
    // A removed piece is not checked at all.
    await listingJob(changed('ev-7', { listingId: 'piece-1' }, badPiece, undefined));

    const filed = (await reports()).sort((a, b) => a.id.localeCompare(b.id));
    expect(filed.map((r) => r.id)).toEqual([
      'auto_listing_piece-1_edit_ev-4',
      'auto_listing_piece-1_edit_ev-5',
    ]);
    // Only what she changed is copied into the report.
    expect(filed[1]!.snapshot).toBe('kys');
    expect(filed[1]!.targetUid).toBe(ELLA);
  });

  it('checks an edited bio or name, against her own account', async () => {
    await profileJob(changed('ev-8', { uid: ELLA }, profile, { ...profile, bio: BAD }));
    await profileJob(changed('ev-9', { uid: ELLA }, profile, { ...profile, bio: 'Gamecocks!' }));
    const filed = await reports();
    expect(filed).toHaveLength(1);
    expect(filed[0]).toMatchObject({ targetType: 'user', targetId: ELLA, targetUid: ELLA });
  });
});

describe('syncPhoneHash', () => {
  const ONE = '+18035550101';
  const TWO = '+18035550102';
  const THREE = '+18035550103';

  const settingsPath = (uid: string) =>
    `${COLLECTIONS.users}/${uid}/${SUBCOLLECTIONS.userPrivate}/settings`;

  /** Saves her number, then hands the job the matching event. */
  async function save(uid: string, before: string | null, after: string | null, id = 'ev') {
    if (after === null) await db.doc(settingsPath(uid)).set({ uid, phone: null });
    else await db.doc(settingsPath(uid)).set({ uid, phone: after });
    await phoneJob(
      changed(id, { uid, docId: 'settings' }, { uid, phone: before }, { uid, phone: after }),
    );
  }

  async function holders(e164: string): Promise<{ uid: string | null; uids: string[] } | null> {
    const snap = await db.doc(`${COLLECTIONS.phoneHashes}/${storedHash(e164)}`).get();
    return snap.exists ? (snap.data() as { uid: string | null; uids: string[] }) : null;
  }

  it('adds, changes and removes her number', async () => {
    await save(ELLA, null, ONE);
    expect(await holders(ONE)).toMatchObject({ uid: ELLA, uids: [ELLA] });

    await save(ELLA, ONE, TWO);
    expect(await holders(ONE)).toBeNull();
    expect(await holders(TWO)).toMatchObject({ uid: ELLA, uids: [ELLA] });

    await save(ELLA, TWO, null);
    expect(await holders(TWO)).toBeNull();
  });

  it('ends on the number saved now, even if two quick edits are handled out of order', async () => {
    // She saves ONE, then TWO, then THREE. The settings doc holds THREE.
    await db.doc(settingsPath(ELLA)).set({ uid: ELLA, phone: THREE });
    // The TWO→THREE event finishes first, then the ONE→TWO event.
    await phoneJob(
      changed('b', { uid: ELLA, docId: 'settings' }, { phone: TWO }, { phone: THREE }),
    );
    await phoneJob(changed('a', { uid: ELLA, docId: 'settings' }, { phone: ONE }, { phone: TWO }));
    // Before, TWO was left pointing at her — a number she no longer has.
    expect(await holders(TWO)).toBeNull();
    expect(await holders(ONE)).toBeNull();
    expect(await holders(THREE)).toMatchObject({ uid: ELLA, uids: [ELLA] });
  });

  it('never hands one girl another girl’s number', async () => {
    await save(ELLA, null, ONE);
    // Anna types Ella's number into her own settings.
    await save(ANNA, null, ONE);
    // Before, the hash moved to Anna: Ella's friends found Anna instead.
    expect(await holders(ONE)).toEqual(expect.objectContaining({ uid: null, uids: [ELLA, ANNA] }));

    // Anna gives it up. Before, that deleted the hash, so Ella vanished too.
    await save(ANNA, ONE, null);
    expect(await holders(ONE)).toMatchObject({ uid: ELLA, uids: [ELLA] });
  });

  it('drops her when her settings are deleted (account deletion)', async () => {
    await save(ELLA, null, ONE);
    await db.doc(settingsPath(ELLA)).delete();
    await phoneJob(
      changed('del', { uid: ELLA, docId: 'settings' }, { uid: ELLA, phone: ONE }, undefined),
    );
    expect(await holders(ONE)).toBeNull();
  });

  it('upgrades an older hash row that only names a uid', async () => {
    await db.doc(`${COLLECTIONS.phoneHashes}/${storedHash(ONE)}`).set({ uid: ELLA });
    await save(ANNA, null, ONE);
    expect(await holders(ONE)).toMatchObject({ uid: null, uids: [ELLA, ANNA] });
  });

  it('a second run of the same event changes nothing', async () => {
    await save(ELLA, null, ONE, 'same');
    await phoneJob(
      changed('same', { uid: ELLA, docId: 'settings' }, { phone: null }, { phone: ONE }),
    );
    expect(await holders(ONE)).toMatchObject({ uid: ELLA, uids: [ELLA] });
  });
});
