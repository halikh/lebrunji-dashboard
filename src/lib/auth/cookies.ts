/**
 * Where the tokens live, and for how long.
 *
 * ## The split, and what it actually buys
 *
 * Two tokens, and they are not equally dangerous to lose:
 *
 * - The **access token** is a short-lived JWT. Stealing one buys an attacker
 *   the rest of its hour.
 * - The **refresh token** mints access tokens indefinitely. Stealing one is
 *   account takeover, and it keeps working after the operator closes the
 *   laptop.
 *
 * The default Supabase browser setup keeps both where JavaScript can read them,
 * so an XSS takes the second. Here **neither cookie is readable by JavaScript**:
 * both are `HttpOnly`, written by route handlers, and the browser holds an
 * access token in memory only — handed to it by `/auth/token`.
 *
 * **What this does not do**, stated plainly because the opposite is easy to
 * assume: it does not make an XSS harmless. Script running on this origin can
 * still call `/auth/token` and get an access token, and can act as the operator
 * for as long as the page is open. What it can no longer do is *exfiltrate a
 * credential that outlives the session* — there is no long-lived secret in the
 * page to take. That is the difference between "an attacker had your dashboard
 * while the tab was open" and "an attacker has your business until someone
 * notices".
 *
 * ## Why two cookies rather than one session blob
 *
 * Server components need an access token to render, and they cannot write
 * cookies — so they cannot refresh. Keeping the access token in its own cookie
 * lets `proxy.ts`, which *can* write, refresh it before the page runs, and lets
 * the page read the result without another round trip.
 */

/** The refresh token. The one that matters. */
export const REFRESH_COOKIE = 'lb-refresh';

/** The current access token, so a server render does not have to mint one. */
export const ACCESS_COOKIE = 'lb-access';

/** Whether this browser asked to be remembered. Not a credential. */
export const REMEMBER_COOKIE = 'lb-remember';

/** Thirty days, when the box is ticked. */
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Refresh a little before the token actually expires.
 *
 * A token that is valid for another two seconds is not worth handing out: the
 * request carrying it can easily arrive after it has expired, and the failure
 * lands as a confusing 401 rather than as a refresh.
 */
export const EXPIRY_MARGIN_SECONDS = 60;

export type CookieAttributes = {
  httpOnly: boolean;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge?: number;
};

/**
 * The attributes every auth cookie gets.
 *
 * `sameSite: 'lax'` rather than `'strict'`: strict would drop the cookie on a
 * navigation *into* the dashboard from another site — including the link in a
 * password-reset email, which is precisely a cross-site navigation that must
 * arrive signed in.
 *
 * `secure` is off on plain http so that localhost works at all; a Secure cookie
 * over http is simply not stored, which presents as a login that silently does
 * nothing.
 */
export function authCookieAttributes(options: {
  remember: boolean;
  isSecure: boolean;
}): CookieAttributes {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: options.isSecure,
    path: '/',
    // No `maxAge` at all when the box is cleared — that is a session cookie,
    // and there is no value of maxAge that means "until the window closes".
    ...(options.remember ? { maxAge: REMEMBER_MAX_AGE } : {}),
  };
}

/** Clearing one. `maxAge: 0` is a deletion; an empty value alone is not. */
export function clearedCookieAttributes(isSecure: boolean): CookieAttributes {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: 0,
  };
}

/**
 * Whether a token is close enough to expiry to be worth replacing.
 *
 * `expiresAt` is the Unix second the token dies, as Supabase reports it.
 * A missing one counts as expired: a token whose lifetime is unknown cannot be
 * assumed good.
 */
export function isExpiring(expiresAt: number | null | undefined, now = Date.now()): boolean {
  if (typeof expiresAt !== 'number') return true;
  return expiresAt - EXPIRY_MARGIN_SECONDS <= Math.floor(now / 1000);
}
