/**
 * Puts Terms v2 and Privacy v2 into `legalDrafts` so they can be read
 * and edited in the admin dashboard.
 *
 * IT WRITES DRAFTS AND NOTHING ELSE. There is no publish path in this
 * file, deliberately: publishing changes what students have agreed to,
 * and that should be a human pressing a button in the dashboard after
 * reading the thing, not a script somebody runs twice.
 *
 *   npx tsx scripts/seedLegalV2Draft.ts                  (emulator)
 *   npx tsx scripts/seedLegalV2Draft.ts --project loane-dev
 *
 * It never touches joinloane.com. Nothing in this repo does.
 */

import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS, type LegalDraft } from '@loane/shared';
import { PRIVACY_V2, TERMS_V2 } from '../src/legal/v2';

const projectArg = process.argv.indexOf('--project');
const projectId = projectArg > -1 ? process.argv[projectArg + 1]! : 'demo-loane';

if (projectId === 'loane-code') {
  throw new Error(
    'Refusing to write drafts to the LIVE project without a deliberate change to this script.',
  );
}

if (projectId === 'demo-loane') {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
}

async function main() {
  const app = initializeApp({ projectId }, 'legal-v2');
  const db = getFirestore(app);

  for (const [kind, text, title] of [
    ['terms', TERMS_V2, 'Terms of Service'],
    ['privacy', PRIVACY_V2, 'Privacy Policy'],
  ] as const) {
    const published = await db
      .collection(COLLECTIONS.legalDocs)
      .where('kind', '==', kind)
      .orderBy('version', 'desc')
      .limit(1)
      .get();
    const nextVersion = (published.docs[0]?.get('version') ?? 0) + 1;

    const draft: Omit<LegalDraft, 'createdAt' | 'updatedAt'> = {
      id: kind,
      kind,
      title,
      text,
      // Left for a human: the date these take effect is a decision
      // about notice, not a value to generate.
      effectiveDate: '',
      significantChange: true,
      nextVersion,
      updatedByUid: 'script',
      updatedByEmail: null,
    };

    await db
      .collection(COLLECTIONS.legalDrafts)
      .doc(kind)
      .set({ ...draft, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

    console.warn(`Draft saved: ${title} → v${nextVersion} (NOT published)`);
  }

  console.warn('\nRead them in the admin dashboard under Legal. Publishing is a separate action.');
  await deleteApp(app);
}

void main();
