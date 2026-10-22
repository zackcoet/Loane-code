import { describe, expect, it } from 'vitest';
import { listingEntryPoint } from '../constants';

describe('listingEntryPoint', () => {
  it('keeps a known entry point', () => {
    expect(listingEntryPoint('trending')).toBe('trending');
  });

  it('drops anything else a route param could carry', () => {
    expect(listingEntryPoint(undefined)).toBeNull();
    expect(listingEntryPoint('')).toBeNull();
    expect(listingEntryPoint('Trending')).toBeNull();
    expect(listingEntryPoint(['trending'])).toBeNull();
    expect(listingEntryPoint('x'.repeat(500))).toBeNull();
  });
});
