import { describe, expect, it } from 'vitest';
import { socialProofCount, socialProofLine } from '../socialProof';

describe('socialProofCount', () => {
  it('hides the number below 50', () => {
    expect(socialProofCount(0)).toBeNull();
    expect(socialProofCount(49)).toBeNull();
    expect(socialProofCount(undefined)).toBeNull();
    expect(socialProofCount(Number.NaN)).toBeNull();
  });

  it('rounds DOWN, so the claim is always true', () => {
    expect(socialProofCount(50)).toBe(50);
    expect(socialProofCount(127)).toBe(120);
    expect(socialProofCount(999)).toBe(990);
    expect(socialProofCount(1342)).toBe(1300);
  });
});

describe('socialProofLine', () => {
  it('reads naturally, with a thousands comma', () => {
    expect(socialProofLine(127, 'South Carolina')).toBe('Join 120+ girls at South Carolina');
    expect(socialProofLine(2050, 'South Carolina')).toBe('Join 2,000+ girls at South Carolina');
    expect(socialProofLine(12, 'South Carolina')).toBeNull();
  });
});
