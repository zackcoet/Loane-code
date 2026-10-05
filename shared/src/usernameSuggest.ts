import { LIMITS, RESERVED_USERNAMES } from './constants';
import { validateUsername } from './validation';

/**
 * Suggest a username from what we already know about her.
 *
 * Signup asks for a first name and a school email, so by the time she
 * reaches the username step we can almost always propose something she
 * recognises. One fewer blank field is one fewer reason to quit.
 *
 * It lives here rather than in the screen because every candidate has to
 * satisfy `validateUsername` — same length, same character set, same
 * reserved list. Two copies of those rules would eventually disagree, and
 * the failure mode is a suggestion the server then rejects.
 */

/**
 * Strip a string down to a legal username body.
 *
 * Usernames are lowercase letters, numbers, periods and underscores.
 * Accented letters are folded to their base (`renée` -> `renee`) rather
 * than dropped, because dropping them mangles a real name.
 */
function sanitize(raw: string): string {
  return (
    raw
      .toLowerCase()
      .normalize('NFD')
      // Combining marks left behind by NFD.
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9._]/g, '')
      // Collapse runs of periods, which validateUsername refuses.
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+|\.+$/g, '')
  );
}

/** The part of an email before the @, sanitized. */
function fromEmail(email: string): string {
  const at = email.indexOf('@');
  return sanitize(at === -1 ? email : email.slice(0, at));
}

/**
 * Candidate usernames, best first.
 *
 * The email's local part comes first because it is what she already types
 * to identify herself every day — `ellapetrick@email.sc.edu` suggests
 * `ellapetrick`, which she will recognise instantly. Her first name alone
 * is a distant second: `ella` is almost certainly taken on any campus, and
 * it tells other students less.
 *
 * Numbered variants come last so the caller can walk the list against a
 * real availability check and still land on something readable.
 */
export function suggestUsernames(
  params: { firstName?: string; campusEmail?: string },
  limit = 8,
): string[] {
  const emailBase = fromEmail(params.campusEmail ?? '');
  const nameBase = sanitize(params.firstName ?? '');

  // A reserved seed is dropped ENTIRELY, not just rejected on its own.
  // `support@sc.edu` must not yield `supportcloset`: that is still a name
  // that looks like it speaks for Loane, which is the whole reason the
  // reserved list exists.
  const usable = (seed: string) =>
    seed.length > 0 && !(RESERVED_USERNAMES as readonly string[]).includes(seed);

  const seeds: string[] = [];
  if (usable(emailBase)) seeds.push(emailBase);
  // Some schools issue numeric or initial-based addresses, where the local
  // part is `epetrick27` or `ep1842`. Her name is the better read then.
  if (usable(nameBase) && nameBase !== emailBase) seeds.push(nameBase);

  const out: string[] = [];
  const seen = new Set<string>();

  const add = (candidate: string) => {
    const trimmed = candidate.slice(0, LIMITS.username.max);
    if (seen.has(trimmed)) return;
    if (!validateUsername(trimmed).ok) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  for (const seed of seeds) add(seed);

  // Then the same seeds with a suffix, so a taken name still yields
  // something that looks chosen rather than generated.
  for (const suffix of ['closet', 'rents', 'fits']) {
    for (const seed of seeds) {
      if (out.length >= limit) break;
      add(`${seed}${suffix}`);
    }
  }

  for (let n = 1; n <= 99 && out.length < limit; n += 1) {
    for (const seed of seeds) {
      if (out.length >= limit) break;
      // Truncate the seed, not the number, or every variant collides at
      // the 30-character limit and they all come out identical.
      const room = LIMITS.username.max - String(n).length;
      add(`${seed.slice(0, room)}${n}`);
    }
  }

  return out.slice(0, limit);
}

/**
 * The single best starting value for the username field.
 *
 * Synchronous and network-free on purpose: the field should already be
 * filled on the first frame. Whether it is actually free is settled by the
 * availability check the screen already runs, and by the transaction on
 * the server, which is the only real answer.
 *
 * Returns an empty string when we have nothing usable — a school address
 * like `2847193@sc.edu` sanitizes to a number, which is legal but a
 * terrible thing to propose as somebody's name.
 */
export function suggestUsername(params: { firstName?: string; campusEmail?: string }): string {
  const [first] = suggestUsernames(params, 1);
  if (!first) return '';
  // All digits reads as an account number, not a person.
  if (/^[0-9._]+$/.test(first)) return '';
  if ((RESERVED_USERNAMES as readonly string[]).includes(first)) return '';
  return first;
}
