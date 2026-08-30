import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { currentAccessToken, type CookieWriter } from '../auth/session';
import { readEnv } from '../env';

/**
 * The server client, for rendering.
 *
 * Carries the **anon key** and the operator's own access token — exactly the
 * authority the browser has, no more. Rendering on the server does not make a
 * request more trustworthy, and a server client holding a service-role key
 * would quietly become how things got done, at which point RLS would be
 * decorative.
 *
 * ## It cannot refresh, and does not need to
 *
 * A server component may not set cookies, so a rotation performed here could
 * not be persisted. `proxy.ts` runs first on every matched request and *can*
 * write, so by the time a page renders the access-token cookie is already
 * fresh. This reads the result.
 */
export async function createServerSupabase() {
  const { supabaseUrl, supabaseAnonKey } = readEnv();
  const token = await readAccessToken();

  return createClient(supabaseUrl, supabaseAnonKey, {
    // Same mechanism as the browser client, for the same reason: this client
    // manages no session of its own, it is simply handed a token.
    accessToken: async () => token,
  });
}

/**
 * The signed-in operator, or null.
 *
 * Answers "is somebody signed in", **not** "are they staff". That second
 * question is `is_admin()`, and it is answered inside the database on every
 * policy and every RPC — never here, where the answer could only be advisory.
 */
export async function getSignedInUser() {
  const token = await readAccessToken();
  if (!token) return null;

  const { supabaseUrl, supabaseAnonKey } = readEnv();
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // `getUser(jwt)` asks the auth server rather than decoding the token here.
  // Decoding would prove only that a well-formed token exists — it would not
  // notice a revoked session, and a revoked session is exactly the case worth
  // noticing.
  const { data } = await supabase.auth.getUser(token);
  return data.user ?? null;
}

async function readAccessToken(): Promise<string | null> {
  const store = await cookies();

  const reader: CookieWriter = {
    get(name) {
      const cookie = store.get(name);
      return cookie ? { value: cookie.value } : undefined;
    },
    // Deliberately inert. A server component cannot set cookies, and silently
    // doing nothing is correct here — see the note above about the proxy.
    set() {},
  };

  const { accessToken } = await currentAccessToken(reader, { write: false, isSecure: true });
  return accessToken;
}
