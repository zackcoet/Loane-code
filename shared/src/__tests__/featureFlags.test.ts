import { describe, expect, it } from 'vitest';
import {
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAG_INFO,
  FEATURE_FLAG_KEYS,
  featureFlagChangeRefusal,
  isFeatureFlagKey,
  resolveFeatureFlags,
  tryOnVisibleTo,
} from '../featureFlags';

describe('resolveFeatureFlags', () => {
  it('a missing document is exactly today’s state: everything risky off, same-day on', () => {
    expect(resolveFeatureFlags(undefined)).toEqual({
      tryOn: false,
      tryOnAdminPreview: false,
      emailVerification: false,
      sameDay: true,
      payments: false,
    });
  });

  it('reads real booleans', () => {
    const flags = resolveFeatureFlags({ sameDay: false, tryOnAdminPreview: true });
    expect(flags.sameDay).toBe(false);
    expect(flags.tryOnAdminPreview).toBe(true);
    expect(flags.tryOn).toBe(false);
  });

  it('a typo in the console cannot switch a feature on', () => {
    const flags = resolveFeatureFlags({ payments: 'true', tryOn: 1, emailVerification: 'yes' });
    expect(flags.payments).toBe(false);
    expect(flags.tryOn).toBe(false);
    expect(flags.emailVerification).toBe(false);
  });

  it('ignores fields it does not know and never mutates the defaults', () => {
    const flags = resolveFeatureFlags({ somethingElse: true, sameDay: false });
    expect(flags).not.toHaveProperty('somethingElse');
    expect(FEATURE_FLAG_DEFAULTS.sameDay).toBe(true);
  });
});

describe('featureFlagChangeRefusal', () => {
  it('email codes and payments cannot be turned on from the dashboard yet', () => {
    expect(featureFlagChangeRefusal('emailVerification', true)).toMatch(/email service/);
    expect(featureFlagChangeRefusal('payments', true)).toMatch(/Stripe/);
  });

  it('anything can always be turned off', () => {
    for (const key of FEATURE_FLAG_KEYS) {
      expect(featureFlagChangeRefusal(key, false)).toBeNull();
    }
  });

  it('try-on and same-day can be turned on', () => {
    expect(featureFlagChangeRefusal('tryOn', true)).toBeNull();
    expect(featureFlagChangeRefusal('tryOnAdminPreview', true)).toBeNull();
    expect(featureFlagChangeRefusal('sameDay', true)).toBeNull();
  });
});

describe('the registry', () => {
  it('every flag has a label and a description', () => {
    for (const key of FEATURE_FLAG_KEYS) {
      expect(FEATURE_FLAG_INFO[key].label.length).toBeGreaterThan(0);
      expect(FEATURE_FLAG_INFO[key].description.length).toBeGreaterThan(0);
    }
  });

  it('isFeatureFlagKey only accepts real keys', () => {
    expect(isFeatureFlagKey('sameDay')).toBe(true);
    expect(isFeatureFlagKey('admin')).toBe(false);
    expect(isFeatureFlagKey(undefined)).toBe(false);
  });
});

describe('tryOnVisibleTo', () => {
  const flags = resolveFeatureFlags(undefined);
  it('off for everyone by default', () => {
    expect(tryOnVisibleTo(flags, false)).toBe(false);
    expect(tryOnVisibleTo(flags, true)).toBe(false);
  });
  it('admin preview shows admins only', () => {
    const preview = { ...flags, tryOnAdminPreview: true };
    expect(tryOnVisibleTo(preview, true)).toBe(true);
    expect(tryOnVisibleTo(preview, false)).toBe(false);
  });
  it('on shows everyone', () => {
    expect(tryOnVisibleTo({ ...flags, tryOn: true }, false)).toBe(true);
  });
});
