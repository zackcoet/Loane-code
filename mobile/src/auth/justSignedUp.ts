/**
 * "She has just created her account", for the root guard.
 *
 * The moment signup signs her in, the root layout sees a profile while
 * she is still on an onboarding screen and moves her on. Before the
 * "Get started" steps existed it moved her to the Feed; now a brand-new
 * account goes to /get-started first. Everyone else — signing in on a
 * new phone, an account from before the steps existed — goes straight
 * to the Feed, because the steps are a welcome, not a wall.
 *
 * In memory on purpose: if the app is closed half way through the
 * steps, she lands on the Feed next time. Those steps are all
 * skippable, so quitting them is an answer too.
 */

let pending = false;

export function markJustSignedUp(): void {
  pending = true;
}

/** Peeks without clearing: the guard's effect can run more than once. */
export function isJustSignedUp(): boolean {
  return pending;
}

/** Called by the Get started screen once it is showing. */
export function clearJustSignedUp(): void {
  pending = false;
}
