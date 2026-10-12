import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone, validatePhone } from '../validation';

/**
 * The contract that matters: every way a student might type her own
 * number has to normalize to the SAME string. Contact matching compares
 * hashes of these, so two people with the same number who typed it
 * differently must still come out identical — otherwise they never
 * match and the feature looks broken for no visible reason.
 */

describe('normalizePhone', () => {
  const sameNumber = [
    '5551234567',
    '555 123 4567',
    '555-123-4567',
    '(555) 123-4567',
    '+1 555 123 4567',
    '+15551234567',
    '1-555-123-4567',
    '  (555) 123 4567  ',
  ];

  it('normalizes every way of typing one US number to the same E.164 string', () => {
    for (const written of sameNumber) {
      expect(normalizePhone(written)).toBe('+15551234567');
    }
  });

  it('is idempotent — normalizing twice changes nothing', () => {
    for (const written of sameNumber) {
      const once = normalizePhone(written);
      expect(normalizePhone(once)).toBe(once);
    }
  });

  it('leaves a non-US E.164 number on its own country code', () => {
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123');
  });

  it('returns empty for empty input', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone('   ')).toBe('');
  });
});

describe('validatePhone', () => {
  it('accepts an empty value, because a phone number is always optional', () => {
    expect(validatePhone('').ok).toBe(true);
    expect(validatePhone('  ').ok).toBe(true);
  });

  it('accepts every way of typing a real US number', () => {
    for (const written of ['5551234567', '(555) 123-4567', '+1 555 123 4567', '15551234567']) {
      expect(validatePhone(written).ok).toBe(true);
    }
  });

  it('rejects a number that is too short or too long to be one', () => {
    for (const written of ['555', '55512345', '5551234567890123']) {
      expect(validatePhone(written).ok).toBe(false);
    }
  });

  it('rejects letters', () => {
    expect(validatePhone('call me').ok).toBe(false);
  });

  it('accepts a plausible international number', () => {
    expect(validatePhone('+44 7700 900123').ok).toBe(true);
  });
});

describe('formatPhone', () => {
  it('shows a US number the way a US student reads one', () => {
    expect(formatPhone('+15551234567')).toBe('(555) 123-4567');
  });

  it('leaves anything it does not recognise exactly as stored', () => {
    expect(formatPhone('+447700900123')).toBe('+447700900123');
  });
});
