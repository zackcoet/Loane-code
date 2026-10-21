/**
 * The automatic content filter — a word list, not an AI.
 *
 * Apple guideline 1.2 asks an app with user content for "a method for
 * filtering objectionable material". This is that method, kept simple
 * and explainable: a caption, comment or message that matches gets an
 * automatic report in the admin Reports queue, with the words copied in.
 *
 * IT FLAGS, IT DOES NOT BLOCK. Nothing is hidden or refused on a match.
 * A word list cannot read context — a friend quoting something, a
 * song lyric — and silently eating somebody's message is worse than a
 * person taking a look. An admin decides, with the one-click tools.
 *
 * The list is deliberately short: threats, self-harm taunts and the
 * most common slurs. Adding a word is one line here.
 */

/** Who an automatic report is "from". Never a real uid. */
export const AUTO_FILTER_REPORTER_UID = 'system:content-filter';

/**
 * Whole phrases, matched on word boundaries after normalizing. Spaces
 * inside a phrase match any run of spaces or punctuation.
 */
const FLAGGED_TERMS: readonly string[] = [
  // Threats and self-harm taunts.
  'kill yourself',
  'kys',
  'go die',
  'i will kill you',
  'im going to kill you',
  'i will hurt you',
  // Slurs. Starting list; matched as whole words only.
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'retard',
  'tranny',
  'spic',
  'chink',
  'kike',
  'dyke',
];

/** Undo the usual disguises: CAPITALS, l33t, accents, punctuation between words. */
export function normalizeForFilter(text: string): string {
  const leet: Record<string, string> = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '@': 'a',
    $: 's',
  };
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      // Accents off: "fàg" is still the word.
      .replace(/[̀-ͯ]/g, '')
      .replace(/[013457@$]/g, (c) => leet[c] ?? c)
      // Apostrophes vanish so "I'm" reads as "im".
      .replace(/['’]/g, '')
      // Everything else that is not a letter becomes a single space.
      .replace(/[^a-z]+/g, ' ')
      .trim()
  );
}

const PATTERNS = FLAGGED_TERMS.map((term) => ({
  term,
  re: new RegExp(`(?:^| )${term.split(' ').join(' ')}(?: |$)`),
}));

/** The listed terms this text contains, or an empty list. */
export function flaggedTerms(text: string | null | undefined): string[] {
  if (!text) return [];
  const normalized = normalizeForFilter(text);
  if (!normalized) return [];
  return PATTERNS.filter((p) => p.re.test(normalized)).map((p) => p.term);
}
