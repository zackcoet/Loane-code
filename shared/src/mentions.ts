/**
 * @mentions in comments.
 *
 * Used on both sides: the phone uses `activeMention` and
 * `insertMention` for the suggestion list while she types, and the
 * server uses `extractMentions` to decide who gets a "mentioned you"
 * alert. One definition, so the handle the phone highlights is exactly
 * the handle the server alerts.
 *
 * A handle is what usernames are allowed to be: lowercase letters,
 * numbers, dots and underscores (see validation.ts). A trailing dot is
 * dropped, because "thanks @ella." means @ella, not @ella. — Instagram
 * reads it the same way.
 */

/** The most people one comment can alert. Past this it is spam, not a tag. */
export const MAX_MENTIONS_PER_COMMENT = 5;

/**
 * Matches @handle where the @ starts the text or follows a space or
 * punctuation that is not part of a handle — so an email address
 * (ella@email.sc.edu) is never read as a mention.
 */
const MENTION = /(^|[^a-z0-9._@])@([a-z0-9._]{1,30})/gi;

function clean(handle: string): string {
  return handle.toLowerCase().replace(/\.+$/, '');
}

/**
 * Every distinct handle mentioned in a comment, lowercase, in the order
 * they appear, capped at MAX_MENTIONS_PER_COMMENT.
 */
export function extractMentions(body: string): string[] {
  const out: string[] = [];
  for (const match of body.matchAll(MENTION)) {
    const handle = clean(match[2] ?? '');
    if (handle.length < 3 || out.includes(handle)) continue;
    out.push(handle);
    if (out.length >= MAX_MENTIONS_PER_COMMENT) break;
  }
  return out;
}

/**
 * Splits a comment into plain text and @handles, so the phone can make
 * the handles tappable. Joined back together, the parts are the body
 * exactly.
 */
export function mentionParts(body: string): { text: string; handle: string | null }[] {
  const parts: { text: string; handle: string | null }[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION)) {
    const lead = match[1] ?? '';
    const start = (match.index ?? 0) + lead.length;
    const raw = `@${match[2] ?? ''}`;
    // Keep a trailing dot as plain text, not part of the link.
    const handle = clean(match[2] ?? '');
    if (handle.length < 3) continue;
    const linked = raw.slice(0, handle.length + 1);
    if (start > last) parts.push({ text: body.slice(last, start), handle: null });
    parts.push({ text: linked, handle });
    last = start + linked.length;
  }
  if (last < body.length) parts.push({ text: body.slice(last), handle: null });
  return parts;
}

/**
 * The handle she is typing right now, if the cursor sits at the end of
 * an @word. Returns the text after the @ (possibly empty, just after
 * typing "@") and where the @ is, or null when she is not mid-mention.
 */
export function activeMention(
  text: string,
  cursor: number,
): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = /(^|[^a-z0-9._@])@([a-z0-9._]{0,30})$/i.exec(before);
  if (!match) return null;
  const query = (match[2] ?? '').toLowerCase();
  return { query, start: cursor - query.length - 1 };
}

/**
 * Replaces the @word being typed with the chosen handle and a space.
 * Returns the new text and where the cursor should go.
 */
export function insertMention(
  text: string,
  cursor: number,
  username: string,
): { text: string; cursor: number } {
  const active = activeMention(text, cursor);
  if (!active) return { text, cursor };
  const inserted = `@${username} `;
  // Swallow a space already after the cursor so we never leave two.
  const after = text.slice(cursor).replace(/^ /, '');
  return {
    text: text.slice(0, active.start) + inserted + after,
    cursor: active.start + inserted.length,
  };
}
