import { onCall } from '../lib/callable';
import {
  COLLECTIONS,
  isIsoDate,
  type LegalDoc,
  type LegalDocKind,
  type LegalDraft,
  type User,
} from '@loane/shared';
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
  // A real day, not just the right shape: "2026-13-45" would otherwise be
  // printed at the top of the Terms as the date they took effect.
  if (!isIsoDate(date)) {
    throw invalidArgument('Use an effective date like 2026-10-05.');
  }
  return date;
}

/**
 * The current published version of one document.
 *
 * One read, not the whole collection. Every published version is kept
 * forever and carries its full text — up to 100,000 characters — so
 * fetching them all to sort in memory meant every signup and every
 * acceptance downloaded the entire legal history of the app.
 *
 * Needs the legalDocs(kind ASC, version DESC) composite index. The
 * emulator does not enforce indexes, so this is one to confirm against
 * the real project after deploying.
 */
export async function latestLegalDoc(kind: LegalDocKind): Promise<LegalDoc | null> {
  const snap = await db()
    .collection(COLLECTIONS.legalDocs)
    .where('kind', '==', kind)
    .orderBy('version', 'desc')
    .limit(1)
    .get();

  const doc = snap.docs[0];
  return doc ? ({ id: doc.id, ...doc.data() } as LegalDoc) : null;
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

  // createdAt only the first time: saving the draft again should not make
  // it look newly started.
  const isNew = !(await ref.get()).exists;
  await ref.set(
    isNew ? { ...draft, createdAt: now(), updatedAt: now() } : { ...draft, updatedAt: now() },
    {
      merge: true,
    },
  );
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
  const draftRef = db().collection(COLLECTIONS.legalDrafts).doc(kind);

  // The number she is publishing is fixed before the step starts, and the
  // step checks it is still the next one. Two admins pressing Publish at
  // the same moment used to both pick the same number, and the second
  // crashed into "something went wrong". Without the fixed number, a
  // retried step would instead quietly publish her text as the version
  // AFTER the other admin's — two new Terms in a row, neither read
  // against the other. Now the second admin is told and nothing is lost.
  const expected = await nextVersion(kind);
  return db().runTransaction(async (tx) => {
    const latestSnap = await tx.get(
      db()
        .collection(COLLECTIONS.legalDocs)
        .where('kind', '==', kind)
        .orderBy('version', 'desc')
        .limit(1),
    );
    const latestVersion = (latestSnap.docs[0]?.data() as LegalDoc | undefined)?.version ?? 0;
    const version = latestVersion + 1;
    const id = legalId(kind, version);
    const ref = db().collection(COLLECTIONS.legalDocs).doc(id);
    if (version !== expected || (await tx.get(ref)).exists) {
      throw failed('Someone just published a new version. Reload and check it before publishing.');
    }

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

    tx.create(ref, { ...doc, createdAt: now(), updatedAt: now(), publishedAt: now() });
    tx.delete(draftRef);
    logAdminAction(tx, {
      admin,
      action: 'publish_legal_doc',
      targetType: 'legalDoc',
      targetId: id,
      notes: `${TITLES[kind]} v${version}${significantChange ? ' (significant change)' : ''}`,
      after: { kind, version, effectiveDate, significantChange },
    });

    return { id, version };
  });
});

export const acceptLegalDocs = onCall<
  { termsVersion: number; privacyVersion: number },
  Promise<{ ok: true }>
>({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) throw unauthenticated();

  const termsVersion: unknown = request.data?.termsVersion;
  const privacyVersion: unknown = request.data?.privacyVersion;
  if (!Number.isInteger(termsVersion) || !Number.isInteger(privacyVersion)) {
    throw invalidArgument('Review the latest legal documents first.');
  }

  const [terms, privacy] = await Promise.all([latestLegalDoc('terms'), latestLegalDoc('privacy')]);
  if (!terms || !privacy) throw notFound('Legal documents are not ready yet.');
  if (terms.version !== termsVersion || privacy.version !== privacyVersion) {
    throw failed('Those legal documents changed. Review the latest version.');
  }

  // A missing or deleted account gets a clear answer rather than a crash
  // (missing) or a deleted shell quietly gaining a fresh acceptance date
  // (deleted) — the date is what we would point to if anyone asked when
  // she agreed.
  const userRef = db().collection(COLLECTIONS.users).doc(request.auth.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists || (userSnap.data() as User).status === 'deactivated') {
    throw notFound('We could not find your account.');
  }

  await userRef.update({
    'legalAccepted.termsVersion': terms.version,
    'legalAccepted.termsAcceptedAt': now(),
    'legalAccepted.privacyVersion': privacy.version,
    'legalAccepted.privacyAcceptedAt': now(),
    updatedAt: now(),
  });

  return { ok: true };
});
