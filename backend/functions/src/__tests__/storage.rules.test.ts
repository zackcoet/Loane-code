/**
 * Storage rules tests.
 *
 * Profile photos are the first thing students upload, so the rule that
 * matters is simple: you write into the folder named after your own uid,
 * and nowhere else.
 *
 * Run the emulators first:  npm run emulators
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

const ELLA = 'uid-ella';
const MADDIE = 'uid-maddie';

let testEnv: RulesTestEnvironment;

const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const meta = { contentType: 'image/jpeg' };

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-loane-storage',
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: readFileSync(resolve(__dirname, '../../../storage.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

const asElla = () => testEnv.authenticatedContext(ELLA).storage();
const asMaddie = () => testEnv.authenticatedContext(MADDIE).storage();
const asStranger = () => testEnv.unauthenticatedContext().storage();
const asAdmin = () => testEnv.authenticatedContext('uid-admin', { admin: true }).storage();

describe('profile photos', () => {
  it('lets her upload into her own folder', async () => {
    await assertSucceeds(
      uploadBytes(ref(asElla(), `users/${ELLA}/profile/avatar.jpg`), jpeg(), meta),
    );
  });

  it('stops her uploading into someone else’s folder', async () => {
    await assertFails(
      uploadBytes(ref(asMaddie(), `users/${ELLA}/profile/avatar.jpg`), jpeg(), meta),
    );
  });

  it('stops a signed-out visitor uploading anything', async () => {
    await assertFails(
      uploadBytes(ref(asStranger(), `users/${ELLA}/profile/avatar.jpg`), jpeg(), meta),
    );
  });

  it('rejects a non-image file', async () => {
    await assertFails(
      uploadBytes(ref(asElla(), `users/${ELLA}/profile/resume.pdf`), jpeg(), {
        contentType: 'application/pdf',
      }),
    );
  });

  it('rejects a file over the 8 MB limit', async () => {
    const tooBig = new Uint8Array(9 * 1024 * 1024);
    await assertFails(uploadBytes(ref(asElla(), `users/${ELLA}/profile/huge.jpg`), tooBig, meta));
  });

  it('lets another signed-in student see her photo', async () => {
    await assertSucceeds(
      uploadBytes(ref(asElla(), `users/${ELLA}/profile/avatar.jpg`), jpeg(), meta),
    );
    await assertSucceeds(getBytes(ref(asMaddie(), `users/${ELLA}/profile/avatar.jpg`)));
  });
});

describe('everything outside a user folder', () => {
  it('is denied', async () => {
    await assertFails(uploadBytes(ref(asElla(), 'somewhere-else/avatar.jpg'), jpeg(), meta));
  });
});

describe('try-on photos — the privacy promise', () => {
  /**
   * These are the only owner-read paths in the whole bucket. Every
   * other path here is readable by at least any signed-in student,
   * because listing and post photos appear in feeds. If one of these
   * tests ever starts failing because somebody "made it consistent
   * with the rules above", that is the bug, not the test.
   */
  const BODY = `users/${ELLA}/tryon/body/me.jpg`;
  const RESULT = `users/${ELLA}/tryon/results/look.jpg`;

  beforeAll(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), BODY), jpeg(), meta);
      await uploadBytes(ref(ctx.storage(), RESULT), jpeg(), meta);
    });
  });

  it('lets her upload her own body photo', async () => {
    await assertSucceeds(
      uploadBytes(ref(asElla(), `users/${ELLA}/tryon/body/new.jpg`), jpeg(), meta),
    );
  });

  it('lets her read her own body photo', async () => {
    await assertSucceeds(getBytes(ref(asElla(), BODY)));
  });

  it('stops ANOTHER STUDENT reading her body photo', async () => {
    await assertFails(getBytes(ref(asMaddie(), BODY)));
  });

  it('stops ANOTHER STUDENT reading her try-on result', async () => {
    await assertFails(getBytes(ref(asMaddie(), RESULT)));
  });

  it('stops a signed-out visitor reading either', async () => {
    await assertFails(getBytes(ref(asStranger(), BODY)));
    await assertFails(getBytes(ref(asStranger(), RESULT)));
  });

  it('stops an ADMIN reading her body photo', async () => {
    // Deliberate, and the absence of an admin rule is the control.
    // "We would only look if we had to" is not a control.
    await assertFails(getBytes(ref(asAdmin(), BODY)));
  });

  it('stops an ADMIN reading her try-on result', async () => {
    await assertFails(getBytes(ref(asAdmin(), RESULT)));
  });

  it('stops her writing a result herself', async () => {
    // Results come from the function via the Admin SDK. If the app
    // could write here it could fabricate a result it never paid for.
    await assertFails(
      uploadBytes(ref(asElla(), `users/${ELLA}/tryon/results/forged.jpg`), jpeg(), meta),
    );
  });

  it('stops her uploading a body photo into someone else’s folder', async () => {
    await assertFails(
      uploadBytes(ref(asMaddie(), `users/${ELLA}/tryon/body/not-me.jpg`), jpeg(), meta),
    );
  });

  it('rejects a non-image body photo', async () => {
    await assertFails(
      uploadBytes(ref(asElla(), `users/${ELLA}/tryon/body/x.pdf`), jpeg(), {
        contentType: 'application/pdf',
      }),
    );
  });
});
