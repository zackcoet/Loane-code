import type { BaseDoc, Timestampish } from './common';

export type LegalDocKind = 'terms' | 'privacy';

export interface LegalDoc extends BaseDoc {
  kind: LegalDocKind;
  title: string;
  text: string;
  version: number;
  effectiveDate: string;
  significantChange: boolean;
  publishedAt: Timestampish;
  publishedByUid: string;
  publishedByEmail: string | null;
}

export interface LegalDraft extends BaseDoc {
  kind: LegalDocKind;
  title: string;
  text: string;
  effectiveDate: string;
  significantChange: boolean;
  /** The version this draft will become if published. */
  nextVersion: number;
  updatedByUid: string;
  updatedByEmail: string | null;
}

export interface LegalAcceptance {
  termsVersion: number | null;
  termsAcceptedAt: Timestampish | null;
  privacyVersion: number | null;
  privacyAcceptedAt: Timestampish | null;
}
