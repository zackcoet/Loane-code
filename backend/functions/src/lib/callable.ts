/**
 * `onCall`, with one safety net: no unexpected error reaches her phone raw.
 *
 * Every callable in this codebase imports `onCall` from here instead of
 * from firebase-functions. Same signature, same behaviour, except for
 * what happens when the handler throws something that ISN'T a deliberate
 * HttpsError (a Firestore timeout, a bug, a missing index):
 *
 * - Before: Firebase turned it into the bare word "INTERNAL", the app
 *   showed a vague fallback, and the log line had no idea which student
 *   or which call it came from.
 * - Now: she gets a specific, human sentence — "busy, try again" when
 *   retrying will help, "something went wrong on our side" with a short
 *   reference code when it won't — and the log gets ONE structured line
 *   with the function, the student and that same code. A screenshot of
 *   the error is enough to find the log entry.
 *
 * Deliberate HttpsErrors pass through untouched: those messages are
 * already written for her (see ./errors.ts).
 */

import { randomBytes } from 'node:crypto';
import { logger } from 'firebase-functions';
import {
  HttpsError,
  onCall as firebaseOnCall,
  type CallableOptions,
  type CallableRequest,
  type CallableResponse,
} from 'firebase-functions/v2/https';

/**
 * Firestore/gRPC status codes that mean "try again and it will probably
 * work". The Admin SDK reports them as numbers; some paths use strings.
 */
const RETRYABLE = new Set<number | string>([
  4, // DEADLINE_EXCEEDED
  8, // RESOURCE_EXHAUSTED
  10, // ABORTED — transaction contention, e.g. two people booking at once
  14, // UNAVAILABLE
  'deadline-exceeded',
  'resource-exhausted',
  'aborted',
  'unavailable',
]);

export const BUSY_MESSAGE = 'Loane is busy right now. Try again in a moment.';

export function failedMessage(ref: string): string {
  return `Something went wrong on our side. Try again — if it keeps happening, send us this code: ${ref}.`;
}

/** A short code she can read out or screenshot. Not secret, just findable. */
export function newErrorRef(): string {
  return randomBytes(3).toString('hex');
}

/**
 * What she sees for an error, and what the log should say about it.
 * Pure, so it is tested without an emulator.
 */
export function toClientError(
  error: unknown,
  ref: string,
): { clientError: HttpsError; expected: boolean } {
  if (error instanceof HttpsError) return { clientError: error, expected: true };
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'number' || typeof code === 'string') {
    if (RETRYABLE.has(code)) {
      return { clientError: new HttpsError('unavailable', BUSY_MESSAGE), expected: false };
    }
  }
  return { clientError: new HttpsError('internal', failedMessage(ref)), expected: false };
}

/** The deployed function's name, as Cloud Run reports it. */
function functionName(): string {
  return process.env.FUNCTION_TARGET ?? process.env.K_SERVICE ?? 'unknown';
}

export function onCall<T = unknown, Return = unknown, Stream = unknown>(
  opts: CallableOptions<T>,
  handler: (request: CallableRequest<T>, response?: CallableResponse<Stream>) => Return,
) {
  return firebaseOnCall<T, Return, Stream>(opts, (async (
    request: CallableRequest<T>,
    response?: CallableResponse<Stream>,
  ) => {
    try {
      return await handler(request, response);
    } catch (error) {
      const ref = newErrorRef();
      const { clientError, expected } = toClientError(error, ref);
      if (!expected) {
        // One structured line per surprise. Never log the request data:
        // it can hold messages, emails or phone hashes.
        logger.error('Callable failed unexpectedly', {
          fn: functionName(),
          uid: request.auth?.uid ?? null,
          ref,
          clientCode: clientError.code,
          errorCode: (error as { code?: unknown } | null)?.code ?? null,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      throw clientError;
    }
  }) as unknown as (request: CallableRequest<T>, response?: CallableResponse<Stream>) => Return);
}
