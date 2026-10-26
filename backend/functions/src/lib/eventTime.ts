/**
 * A background job's event time in milliseconds: when the write that
 * started it was saved by the server — not when the job got round to
 * running, and not any time a phone wrote on the document.
 *
 * Falls back to now if the time is missing or unreadable.
 */
export function eventMillis(time: unknown): number {
  const ms = typeof time === 'string' ? Date.parse(time) : NaN;
  return Number.isNaN(ms) ? Date.now() : ms;
}
