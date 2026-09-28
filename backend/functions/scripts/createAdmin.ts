/**
 * Create (or re-point) an admin login on a real project.
 *
 * Admins are not students. They have no campus email, no closet and no
 * profile document — the thing that makes someone an admin is the
 * custom claim, because the security rules read the claim and never a
 * database field. A field is something somebody might find a way to
 * write. See the isAdmin() helper in firestore.rules.
 *
 * THE PASSWORD COMES FROM THE ENVIRONMENT, never an argument, so it
 * does not end up in shell history or in the output of `ps`.
 *
 *   LOANE_ADMIN_PASSWORD='...' npx tsx scripts/createAdmin.ts \
 *     --project loane-code --email someone@example.com
 *
 * Safe to run twice: an existing account has its password reset and
 * the claim reapplied rather than erroring.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const projectId = arg('project');
const email = arg('email');
const password = process.env.LOANE_ADMIN_PASSWORD;

if (!projectId || !email) {
  console.error('Usage: --project <id> --email <address>, with LOANE_ADMIN_PASSWORD set.');
  process.exit(1);
}
if (projectId.startsWith('demo-')) {
  console.error('Refusing: that is an emulator project. Use npm run seed.');
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error('Set LOANE_ADMIN_PASSWORD to at least 8 characters.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();

async function main(): Promise<void> {
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email!);
    await auth.updateUser(existing.uid, { password, emailVerified: true });
    uid = existing.uid;
    console.warn(`Account already existed — password reset. ${email}`);
  } catch {
    const created = await auth.createUser({ email: email!, password, emailVerified: true });
    uid = created.uid;
    console.warn(`Created login for ${email}`);
  }

  await auth.setCustomUserClaims(uid, { admin: true });
  console.warn(`Admin claim set (${uid})`);
  console.warn('\nShe must sign in fresh for the claim to be in her token.');
  console.warn('Nothing was written to Firestore: an admin is not a student.');
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Failed:', error);
    process.exit(1);
  });
