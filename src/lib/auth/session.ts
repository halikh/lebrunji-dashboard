import 'server-only';

import { createClient, type Session } from '@supabase/supabase-js';

import { readEnv } from '../env';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REMEMBER_COOKIE,
  authCookieAttributes,
  clearedCookieAttributes,
  isExpiring,
} from './cookies';

/**
 * The server side of authentication. Nothing here ever reaches the browser.
 *
 * `server-only` at the top is not decoration: it makes importing this from a
 * client component a build error rather than a bundle that quietly ships the
 * refresh-token handling to the browser, which is the one mistake this whole
 * design exists to prevent.
 *
 * The client used here still holds only the **anon key** — the split is about
 * where tokens are *stored*, not about privilege. RLS and `is_admin()` remain
 * the whole of authorisation.
 */

/** A minimal cookie interface, so this works in both a route handler and the proxy. */
export type CookieWriter = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, attributes: Record<string, unknown>): void;
};

/**
 * A client with no session of its own.
 *
 * `persistSession: false` and `autoRefreshToken: false` because a server
 * handles many people's requests on one process: a client that remembered a
 * session would be remembering it for everybody, and a background refresh timer
 * would run forever against whoever signed in last.
 */
export function anonymousClient() {
  const { supabaseUrl, supabaseAnonKey } = readEnv();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type TokenPair = { accessToken: string; refreshToken: string; expiresAt: number };

function toPair(session: Session): TokenPair {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    // Supabase reports this in seconds. A session without one is treated as
    // already expiring, so the next request refreshes rather than trusting it.
    expiresAt: session.expires_at ?? 0,
  };
}

/** Writes both tokens as HttpOnly cookies, honouring the remember-me choice. */
export function writeSession(
  cookies: CookieWriter,
  pair: TokenPair,
  options: { remember: boolean; isSecure: boolean },
) {
  const attributes = authCookieAttributes(options);
  cookies.set(ACCESS_COOKIE, pair.accessToken, attributes);
  cookies.set(REFRESH_COOKIE, pair.refreshToken, attributes);
}

export function clearSession(cookies: CookieWriter, isSecure: boolean) {
  const cleared = clearedCookieAttributes(isSecure);
  cookies.set(ACCESS_COOKIE, '', cleared);
  cookies.set(REFRESH_COOKIE, '', cleared);
}

export function readRemember(cookies: CookieWriter): boolean {
  return cookies.get(REMEMBER_COOKIE)?.value === '1';
}

/**
 * The current access token, refreshing it if it is spent.
 *
 * This is the single place a refresh happens, and every caller goes through it:
 * the proxy before a page renders, `/auth/token` when the browser needs one,
 * and any server component that has to read data.
 *
 * ## On rotation, and why a failed refresh signs you out
 *
 * Supabase rotates refresh tokens: using one invalidates it and issues another.
 * So a refresh that fails means the token was already spent or revoked, and
 * there is no recovering from it — holding on to the cookie would produce a
 * dashboard that fails every request while insisting it is signed in. Clearing
 * it and going to `/login` is the honest outcome.
 *
 * `write` is optional because a **server component cannot set cookies**. Called
 * from one, this still returns a working token; it simply cannot persist the
 * rotation, so the next request refreshes again. That is why `proxy.ts` — which
 * can write — refreshes first, and the page usually finds a fresh token
 * already there.
 */
export async function currentAccessToken(
  cookies: CookieWriter,
  options: { write?: boolean; isSecure: boolean },
): Promise<{ accessToken: string | null; expiresAt: number | null }> {
  const access = cookies.get(ACCESS_COOKIE)?.value;
  const refresh = cookies.get(REFRESH_COOKIE)?.value;

  if (!refresh) return { accessToken: null, expiresAt: null };

  const expiresAt = access ? expiryOf(access) : null;
  if (access && !isExpiring(expiresAt)) {
    return { accessToken: access, expiresAt };
  }

  const supabase = anonymousClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refresh });

  if (error || !data.session) {
    if (options.write) clearSession(cookies, options.isSecure);
    return { accessToken: null, expiresAt: null };
  }

  const pair = toPair(data.session);
  if (options.write) {
    writeSession(cookies, pair, {
      remember: readRemember(cookies),
      isSecure: options.isSecure,
    });
  }

  return { accessToken: pair.accessToken, expiresAt: pair.expiresAt };
}

/**
 * When a JWT expires, read from the token itself.
 *
 * The alternative is a third cookie holding the expiry, which would be one more
 * thing that can disagree with the token it describes. The claim is inside the
 * token already.
 *
 * **This is not verification.** Nothing here checks the signature, and nothing
 * needs to: an attacker who can forge this claim can only make the dashboard
 * refresh sooner or later than ideal, and the token is then rejected by
 * Supabase, which does check. Decoding is a scheduling hint, not a decision.
 */
export function expiryOf(jwt: string): number | null {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8',
    );
    const exp: unknown = JSON.parse(json).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

export { toPair };
