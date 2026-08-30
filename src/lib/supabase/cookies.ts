/**
 * Remember me, expressed as a cookie lifetime.
 *
 * ## What the checkbox actually controls
 *
 * A session cookie — one written with no `Max-Age` and no `Expires` — is
 * discarded when the browser window closes. One written with a `Max-Age`
 * survives it. That is the whole mechanism, and it is worth being precise about
 * what it does and does not do:
 *
 * - It **does** decide whether closing the browser signs you out on this
 *   machine, which is what someone ticking or clearing the box is asking for.
 * - It **does not** shorten the Supabase refresh token itself, which has its
 *   own server-side lifetime and is unaffected by how long a browser chose to
 *   keep a copy. Clearing the box is "do not leave me signed in here", not
 *   "revoke this session everywhere".
 *
 * Saying so plainly matters because the opposite is easy to assume, and an
 * operator on a shared machine is exactly who ticks it off.
 *
 * ## How the preference survives the redirect
 *
 * Supabase writes its auth cookies during `signInWithPassword`, from inside its
 * own client — this module never sees the sign-in call. So the choice is
 * recorded first, in a cookie of its own, and read back by the cookie writer
 * every time it runs. It is a preference, not a credential: knowing it grants
 * nothing.
 */

export const REMEMBER_COOKIE = 'lebrunji-remember';

/** Thirty days. Long enough to be the point of the box, short enough to end. */
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;

export type CookieOptions = {
  maxAge?: number;
  expires?: Date;
  [key: string]: unknown;
};

/**
 * Applies the preference to one cookie's options.
 *
 * When the box was cleared, `maxAge` and `expires` are **removed** rather than
 * set to something small — a cookie with neither is a session cookie, and there
 * is no value of `maxAge` that means "until the window closes".
 */
export function withRememberMe(options: CookieOptions, remember: boolean): CookieOptions {
  if (remember) {
    return { ...options, maxAge: options.maxAge ?? REMEMBER_MAX_AGE };
  }
  const { maxAge: _maxAge, expires: _expires, ...session } = options;
  return session;
}
