/**
 * The callable safety net (lib/callable.ts). No emulator needed.
 */

import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { describe, expect, it, vi } from 'vitest';
import { BUSY_MESSAGE, failedMessage, newErrorRef, onCall, toClientError } from '../lib/callable';

const request = (uid = 'student-1') =>
  ({ auth: { uid }, data: {} }) as unknown as CallableRequest<unknown>;

describe('toClientError', () => {
  it('passes a deliberate HttpsError through unchanged', () => {
    const original = new HttpsError('already-exists', 'Those dates were just taken.');
    const { clientError, expected } = toClientError(original, 'abc123');
    expect(clientError).toBe(original);
    expect(expected).toBe(true);
  });

  it.each([4, 8, 10, 14, 'unavailable', 'aborted'])(
    'says "busy, try again" for a retryable Firestore code (%s)',
    (code) => {
      const err = Object.assign(new Error('raw detail'), { code });
      const { clientError, expected } = toClientError(err, 'abc123');
      expect(clientError.code).toBe('unavailable');
      expect(clientError.message).toBe(BUSY_MESSAGE);
      expect(expected).toBe(false);
    },
  );

  it('turns anything else into a friendly message with the reference code', () => {
    const { clientError, expected } = toClientError(new TypeError('x is undefined'), 'abc123');
    expect(clientError.code).toBe('internal');
    expect(clientError.message).toBe(failedMessage('abc123'));
    expect(clientError.message).toContain('abc123');
    expect(expected).toBe(false);
  });

  it('never leaks the raw error text to her', () => {
    const err = Object.assign(new Error('users/abc-uid-123 FAILED_PRECONDITION index'), {
      code: 9,
    });
    const { clientError } = toClientError(err, 'ref000');
    expect(clientError.message).not.toContain('abc-uid-123');
    expect(clientError.message).not.toContain('index');
  });

  it('copes with things that are not Errors at all', () => {
    expect(toClientError(undefined, 'r').clientError.code).toBe('internal');
    expect(toClientError('a string', 'r').clientError.code).toBe('internal');
  });
});

describe('newErrorRef', () => {
  it('is six hex characters', () => {
    expect(newErrorRef()).toMatch(/^[0-9a-f]{6}$/);
  });
});

describe('onCall wrapper', () => {
  it('returns the handler result untouched', async () => {
    const fn = onCall<unknown, Promise<{ ok: true }>>({}, async () => ({ ok: true }));
    await expect(fn.run(request())).resolves.toEqual({ ok: true });
  });

  it('rethrows a deliberate HttpsError without logging it as a failure', async () => {
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const fn = onCall({}, () => {
      throw new HttpsError('permission-denied', "You can't do that.");
    });
    await expect(fn.run(request())).rejects.toMatchObject({
      code: 'permission-denied',
      message: "You can't do that.",
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logs one structured line with the student and the same code she sees', async () => {
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const fn = onCall({}, async () => {
      throw new Error('boom');
    });

    let shown = '';
    try {
      await fn.run(request('student-42'));
    } catch (e) {
      shown = (e as HttpsError).message;
      expect((e as HttpsError).code).toBe('internal');
    }

    expect(spy).toHaveBeenCalledTimes(1);
    const [, fields] = spy.mock.calls[0] as [string, Record<string, unknown>];
    expect(fields.uid).toBe('student-42');
    expect(fields.message).toBe('boom');
    expect(shown).toContain(String(fields.ref));
    spy.mockRestore();
  });
});
