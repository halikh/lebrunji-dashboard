import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { readEnv } from '../env';

/**
 * The server client, for the few things that happen before the browser does.
 *
 * Deliberately small. Almost everything reads through the browser client, for
 * the reasons in `client.ts` — so this exists for server components that need
 * to know *whether* someone is signed in before rendering, and for the auth
 * callback route.
 *
 * It carries the **anon key**, exactly like the browser one. There is no
 * elevated server-side identity in this app: rendering on the server does not
 * make a request more trustworthy, and a server client holding a service-role
 * key would quietly become the way things got done, at which point RLS would
 * be decorative.
 */
export async function createClient() {
  const { supabaseUrl, supabaseAnonKey } = readEnv();
  const store = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes the session on every request, so the write
          // this swallowed has already happened somewhere it was allowed.
        }
      },
    },
  });
}

/**
 * Who is signed in, according to the auth server.
 *
 * `getUser()` rather than `getSession()`, and the difference matters: a session
 * is read out of the cookie and is only as trustworthy as the cookie, while
 * `getUser` revalidates the token. Anything deciding what to render should ask
 * this one.
 *
 * It answers "is somebody signed in", **not** "are they staff". That question
 * is `is_admin()`, and it is answered inside the database on every policy and
 * every RPC — never here, where the answer could only ever be advisory.
 */
export async function getSignedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
