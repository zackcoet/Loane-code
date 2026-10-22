/**
 * The switchboard: one document, `config/features`, that turns risky or
 * unfinished features on and off without a new app build.
 *
 * WHY ONE DOCUMENT. Before this, try-on lived at `config/tryOn`, email
 * codes at `config/verification`, and same-day and payments had no switch
 * at all. Four places to look is how a switch gets forgotten. Now the
 * admin dashboard shows every one on a single panel, every change goes
 * through one audited function, and the app reads one document.
 *
 * DEFAULTS ARE TODAY'S STATE. A missing or half-written document must not
 * change what students see, and it must never be an open door: anything
 * that spends money or could lock people out defaults OFF. Same-day is the
 * one default that is on, because it is live today and costs nothing.
 *
 * LOCKED FLAGS. Some switches cannot be turned on from the dashboard,
 * because flipping them before their setup exists breaks the app for
 * everybody (email codes with no email service lock every new student
 * out; payments with no Stripe account charge nobody and confuse
 * everybody). Turning a locked flag OFF is always allowed. Unlocking one
 * is a deliberate code change, made when the setup is real.
 */

/** `config/{FEATURE_FLAGS_DOC}`. */
export const FEATURE_FLAGS_DOC = 'features';

export const FEATURE_FLAG_KEYS = [
  'tryOn',
  'tryOnAdminPreview',
  'emailVerification',
  'sameDay',
  'payments',
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

/** The whole stored document. */
export interface FeatureFlagsDoc extends Partial<FeatureFlags> {
  updatedAt?: unknown;
  updatedBy?: string | null;
}

export const FEATURE_FLAG_DEFAULTS: Readonly<FeatureFlags> = Object.freeze({
  // Off for v1, back in v2. docs/decisions.md 2026-10-13.
  tryOn: false,
  // Off too: with no FASHN key on a project it only shows admins a
  // button that fails.
  tryOnAdminPreview: false,
  // Paused until a real email service sends codes. docs/decisions.md.
  emailVerification: false,
  // Live today, costs nothing. The off switch is for a bad weekend.
  sameDay: true,
  // Waiting on Loane, Inc.'s Stripe account. docs/payments.md.
  payments: false,
});

export interface FeatureFlagInfo {
  label: string;
  /** What "on" means, in a sentence an admin can act on. */
  description: string;
  /**
   * Set when the flag may not be turned ON from the dashboard yet, and
   * says why. Turning it off is always allowed.
   */
  lockedReason: string | null;
}

export const FEATURE_FLAG_INFO: Readonly<Record<FeatureFlagKey, FeatureFlagInfo>> = {
  tryOn: {
    label: 'AI Try-On',
    description:
      'Shows "Try it on" to every student. Each new generation costs about $0.08. Publish the try-on Terms clause first.',
    lockedReason: null,
  },
  tryOnAdminPreview: {
    label: 'AI Try-On — admin preview',
    description: 'Shows try-on to admin accounts only, to test it on the real project.',
    lockedReason: null,
  },
  emailVerification: {
    label: 'Email codes at sign-up',
    description: 'Students must type a 6-digit code from their sc.edu email before using Loane.',
    lockedReason:
      'Needs an email service (Resend) set up and one real code delivered to an sc.edu inbox first.',
  },
  sameDay: {
    label: 'Same-day pickup',
    description:
      'Lets lenders offer a piece for today and renters ask for it. Off hides the option and refuses requests for today.',
    lockedReason: null,
  },
  payments: {
    label: 'Payments',
    description: 'Card payments and payouts through Stripe.',
    lockedReason: "Waiting on Loane, Inc.'s Stripe account. See docs/payments.md.",
  },
};

export function isFeatureFlagKey(value: unknown): value is FeatureFlagKey {
  return typeof value === 'string' && (FEATURE_FLAG_KEYS as readonly string[]).includes(value);
}

/**
 * The stored document → the flags in force. Anything missing or not a
 * real boolean falls back to the default, so a typo in the console
 * cannot switch a feature on.
 */
export function resolveFeatureFlags(data: unknown): FeatureFlags {
  const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const flags = { ...FEATURE_FLAG_DEFAULTS };
  for (const key of FEATURE_FLAG_KEYS) {
    if (typeof raw[key] === 'boolean') flags[key] = raw[key] as boolean;
  }
  return flags;
}

/** Null when the change is allowed, otherwise the reason it is refused. */
export function featureFlagChangeRefusal(key: FeatureFlagKey, value: boolean): string | null {
  if (!value) return null;
  return FEATURE_FLAG_INFO[key].lockedReason;
}

/** Whether try-on is visible to this person. The server checks again. */
export function tryOnVisibleTo(flags: FeatureFlags, isAdmin: boolean): boolean {
  return flags.tryOn || (flags.tryOnAdminPreview && isAdmin);
}
