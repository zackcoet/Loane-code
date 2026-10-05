/**
 * Seeds Terms v1 and Privacy v1 into the active Firebase project/emulator.
 *
 * This never overwrites an existing published version. Run against emulators
 * for local data, or against a named project only after Zack approves.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS, type LegalDocKind } from '@loane/shared';
import { LEGAL_V1_EFFECTIVE_DATE, PRIVACY_V1, TERMS_V1 } from '../src/legal/v1';

if (getApps().length === 0)
  initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-loane' });

const db = getFirestore();

const docs: Array<{ kind: LegalDocKind; id: string; title: string; text: string }> = [
  { kind: 'terms', id: 'terms_v1', title: 'Terms & Conditions', text: TERMS_V1 },
  { kind: 'privacy', id: 'privacy_v1', title: 'Privacy Policy', text: PRIVACY_V1 },
];

async function main() {
  for (const doc of docs) {
    const ref = db.collection(COLLECTIONS.legalDocs).doc(doc.id);
    const existing = await ref.get();
    if (existing.exists) {
      console.warn(`Skipping ${doc.id}; it already exists.`);
      continue;
    }
    await ref.set({
      id: doc.id,
      kind: doc.kind,
      title: doc.title,
      text: doc.text,
      version: 1,
      effectiveDate: LEGAL_V1_EFFECTIVE_DATE,
      significantChange: false,
      publishedAt: FieldValue.serverTimestamp(),
      publishedByUid: 'seed',
      publishedByEmail: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.warn(`Seeded ${doc.id}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
