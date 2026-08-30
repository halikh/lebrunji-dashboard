/**
 * The dashboard's own strings.
 *
 * ## One language, built to take more
 *
 * The dashboard ships in English. But no screen contains a bare user-facing
 * string — every one reads through `t()`, exactly as the app does in
 * `src/i18n/translations.ts`. Adding a second language is then: add its code to
 * `Locale`, add its object below, and flip the shell to RTL if the script needs
 * it. A file to fill, rather than a sweep through forty components.
 *
 * That discipline is worth nothing if it decays, so an ESLint rule forbids
 * literal text in JSX. The cost of writing `t('orders.confirm')` today is a few
 * seconds; the cost of finding every string later is a week.
 *
 * ## This is not where content lives
 *
 * The distinction the app draws, and the test that settles it: **can a row
 * appear without a release?**
 *
 * - **This file** is chrome — buttons, headings, errors. It ships with the
 *   build, and a typo is caught at build time.
 * - **A `jsonb` column on the row** is content — store names, menu items,
 *   help topics. Those carry every language in one column and are edited *by*
 *   this dashboard, which is what `LocalizedField` is for.
 *
 * So the number of languages here and the number of languages in the
 * `languages` table are unrelated, and neither constrains the other.
 */

export type Locale = 'en';

export const DEFAULT_LOCALE: Locale = 'en';

const en = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    signOut: 'Sign out',
    somethingWentWrong: 'Something went wrong. Try again.',
  },

  login: {
    title: 'Sign in',
    subtitle: 'Operations for Lebrunji.',
    email: 'Email',
    password: 'Password',
    rememberMe: 'Keep me signed in on this device',
    submit: 'Sign in',
    forgot: 'Forgotten your password?',
    // Deliberately does not distinguish "no such account" from "wrong
    // password". The pair would tell anyone who asked which email addresses
    // are staff.
    failed: 'That email and password do not match.',
  },

  forgotPassword: {
    title: 'Reset your password',
    subtitle: 'We will email you a link.',
    submit: 'Send the link',
    backToLogin: 'Back to sign in',
    // Shown whether or not the address exists, so the form cannot be used to
    // find out which addresses are staff.
    sent: 'If that address has an account, a reset link is on its way.',
  },

  resetPassword: {
    title: 'Choose a new password',
    password: 'New password',
    confirm: 'Confirm it',
    submit: 'Save the password',
    mismatch: 'Those two do not match.',
    tooShort: 'Use at least 12 characters.',
    // The recovery link is single-use and time-limited, so this is a normal
    // thing to hit rather than an error worth alarming about.
    expired: 'That link has expired. Ask for a new one.',
    done: 'Saved. You can sign in with it now.',
  },
} as const;

/** Every locale's shape, taken from the one that is complete. */
type Strings = typeof en;

const bundles: Record<Locale, Strings> = { en };

/** Dotted key into the bundle — `login.submit`. */
type Path<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : Path<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Path<Strings>;

/**
 * Looks a key up.
 *
 * Returns the key itself when it is missing, rather than an empty string: a
 * screen showing `orders.advnace` is obviously broken, and a screen showing
 * nothing is a bug someone has to hunt for.
 */
export function t(key: TranslationKey, locale: Locale = DEFAULT_LOCALE): string {
  const parts = key.split('.');
  let value: unknown = bundles[locale];
  for (const part of parts) {
    if (typeof value !== 'object' || value === null) return key;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string' ? value : key;
}
