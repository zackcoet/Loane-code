import { onCall } from 'firebase-functions/v2/https';
import { COLLECTIONS, type LegalDoc, type LegalDocKind, type LegalDraft } from '@loane/shared';
import { db, now } from '../lib/admin';
import { failed, invalidArgument, notFound, unauthenticated } from '../lib/errors';
import { logAdminAction, requireAdminContext } from '../admin/audit';

const TITLES: Record<LegalDocKind, string> = {
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
};

function legalId(kind: LegalDocKind, version: number) {
  return `${kind}_v${version}`;
}

function requireKind(value: unknown): LegalDocKind {
  if (value === 'terms' || value === 'privacy') return value;
  throw invalidArgument('Choose Terms or Privacy.');
}

function requireText(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < 100) throw invalidArgument('The legal text is too short.');
  if (text.length > 100_000) throw invalidArgument('The legal text is too long.');
  return text;
}

function requireEffectiveDate(value: unknown): string {
  const date = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw invalidArgument('Use an effective date like 2026-10-05.');
  }
  return date;
}

export async function latestLegalDoc(kind: LegalDocKind): Promise<LegalDoc | null> {
  const snap = await db().collection(COLLECTIONS.legalDocs).where('kind', '==', kind).get();
  return (
    snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as LegalDoc)
      .sort((a, b) => b.version - a.version)[0] ?? null
  );
}

async function nextVersion(kind: LegalDocKind): Promise<number> {
  const latest = await latestLegalDoc(kind);
  return (latest?.version ?? 0) + 1;
}

export async function latestLegalVersions(): Promise<{
  termsVersion: number | null;
  privacyVersion: number | null;
}> {
  const [terms, privacy] = await Promise.all([latestLegalDoc('terms'), latestLegalDoc('privacy')]);
  return {
    termsVersion: terms?.version ?? null,
    privacyVersion: privacy?.version ?? null,
  };
}

export const saveLegalDraft = onCall<
  { kind: LegalDocKind; text: string; effectiveDate: string; significantChange: boolean },
  Promise<{ ok: true; nextVersion: number }>
>({ region: 'us-central1' }, async (request) => {
  const admin = requireAdminContext(request);
  const kind = requireKind(request.data?.kind);
  const text = requireText(request.data?.text);
  const effectiveDate = requireEffectiveDate(request.data?.effectiveDate);
  const significantChange = request.data?.significantChange === true;
  const version = await nextVersion(kind);

  const ref = db().collection(COLLECTIONS.legalDrafts).doc(kind);
  const draft: Omit<LegalDraft, 'createdAt' | 'updatedAt'> = {
    id: kind,
    kind,
    title: TITLES[kind],
    text,
    effectiveDate,
    significantChange,
    nextVersion: version,
    updatedByUid: admin.uid,
    updatedByEmail: admin.email,
  };

  await ref.set({ ...draft, updatedAt: now(), createdAt: now() }, { merge: true });
  return { ok: true, nextVersion: version };
});

export const publishLegalDoc = onCall<
  { kind: LegalDocKind; text: string; effectiveDate: string; significantChange: boolean },
  Promise<{ id: string; version: number }>
>({ region: 'us-central1' }, async (request) => {
  const admin = requireAdminContext(request);
  const kind = requireKind(request.data?.kind);
  const text = requireText(request.data?.text);
  const effectiveDate = requireEffectiveDate(request.data?.effectiveDate);
  const significantChange = request.data?.significantChange === true;
  const version = await nextVersion(kind);
  const id = legalId(kind, version);
  const ref = db().collection(COLLECTIONS.legalDocs).doc(id);
  const draftRef = db().collection(COLLECTIONS.legalDrafts).doc(kind);

  const batch = db().batch();
  const existing = await ref.get();
  if (existing.exists) throw failed('That legal version already exists.');

  const doc: Omit<LegalDoc, 'createdAt' | 'updatedAt' | 'publishedAt'> = {
    id,
    kind,
    title: TITLES[kind],
    text,
    version,
    effectiveDate,
    significantChange,
    publishedByUid: admin.uid,
    publishedByEmail: admin.email,
  };

  batch.create(ref, { ...doc, createdAt: now(), updatedAt: now(), publishedAt: now() });
  batch.delete(draftRef);
  logAdminAction(batch, {
    admin,
    action: 'publish_legal_doc',
    targetType: 'legalDoc',
    targetId: id,
    notes: `${TITLES[kind]} v${version}${significantChange ? ' (significant change)' : ''}`,
    after: { kind, version, effectiveDate, significantChange },
  });
  await batch.commit();

  return { id, version };
});

export const acceptLegalDocs = onCall<
  { termsVersion: number; privacyVersion: number },
  Promise<{ ok: true }>
>({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) throw unauthenticated();

  const termsVersion = Number(request.data?.termsVersion);
  const privacyVersion = Number(request.data?.privacyVersion);
  if (!Number.isInteger(termsVersion) || !Number.isInteger(privacyVersion)) {
    throw invalidArgument('Review the latest legal documents first.');
  }

  const [terms, privacy] = await Promise.all([latestLegalDoc('terms'), latestLegalDoc('privacy')]);
  if (!terms || !privacy) throw notFound('Legal documents are not ready yet.');
  if (terms.version !== termsVersion || privacy.version !== privacyVersion) {
    throw failed('Those legal documents changed. Review the latest version.');
  }

  await db().collection(COLLECTIONS.users).doc(request.auth.uid).update({
    'legalAccepted.termsVersion': terms.version,
    'legalAccepted.termsAcceptedAt': now(),
    'legalAccepted.privacyVersion': privacy.version,
    'legalAccepted.privacyAcceptedAt': now(),
    updatedAt: now(),
  });

  return { ok: true };
});
