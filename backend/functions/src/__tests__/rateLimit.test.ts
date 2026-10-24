import { describe, expect, it } from 'vitest';
import { callerIp, LIMITS } from '../lib/rateLimit';

/**
 * The parts of the rate limiter that need no database. The counting
 * itself runs in a Firestore transaction and is exercised by the
 * emulator suites through the functions that call it.
 */

describe('callerIp — who is signing up', () => {
  it('takes the first address the proxy forwarded', () => {
    expect(callerIp({ headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } })).toBe(
      '203.0.113.7',
    );
  });

  it('falls back to the connection address', () => {
    expect(callerIp({ ip: '198.51.100.4', headers: {} })).toBe('198.51.100.4');
  });

  it('is null when there is nothing to go on, so nobody shares a bucket', () => {
    // The bug this guards: a constant like 'unknown' put every such
    // caller in ONE bucket, so the whole world shared one hourly limit.
    expect(callerIp({})).toBeNull();
    expect(callerIp({ headers: {} })).toBeNull();
    expect(callerIp({ ip: '', headers: { 'x-forwarded-for': '' } })).toBeNull();
    expect(callerIp({ ip: '  ', headers: { 'x-forwarded-for': ' , 10.0.0.1' } })).toBeNull();
  });

  it('ignores a forwarded header that is not a string', () => {
    expect(callerIp({ ip: '198.51.100.4', headers: { 'x-forwarded-for': ['x'] } })).toBe(
      '198.51.100.4',
    );
  });
});

describe('LIMITS — the ceilings', () => {
  it('every limit allows at least one and has a window', () => {
    for (const [name, limit] of Object.entries(LIMITS)) {
      expect(limit.max, name).toBeGreaterThanOrEqual(1);
      expect(limit.windowMs, name).toBeGreaterThan(0);
    }
  });

  it('never shows her a number or the word "limit"', () => {
    // The messages are written for a student, not a log file.
    for (const [name, limit] of Object.entries(LIMITS)) {
      expect(limit.message, name).not.toMatch(/\d/);
      expect(limit.message.toLowerCase(), name).not.toContain('limit');
    }
  });

  it('lets a campus launch table sign students up on one shared wifi', () => {
    // A tabling event on campus wifi puts dozens of girls behind one
    // address in an hour. If they hit this, the number is wrong.
    expect(LIMITS.signUp.max).toBeGreaterThanOrEqual(30);
  });

  it('lets a big address book be checked a few times a day', () => {
    // The app reads up to 3,000 contacts and sends 500 numbers a call.
    // With two numbers each that is 12 calls; three full checks must fit.
    expect(LIMITS.contactMatch.max).toBeGreaterThanOrEqual(3 * Math.ceil(6000 / 500));
    expect(LIMITS.contactMatch.windowMs).toBeGreaterThanOrEqual(3600_000);
  });
});
