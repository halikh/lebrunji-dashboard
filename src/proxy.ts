import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { readEnv } from './lib/env';
import { REMEMBER_COOKIE, withRememberMe, type CookieOptions } from './lib/supabase/cookies';

/**
 * Next 16 renamed this convention from `middleware.ts` to `proxy.ts`. Same
 * file, same hook, and the new name is the more honest one — what follows is
 * emphatically *not* where access is decided.
 *
 * Two jobs, and it is important that it is only two.
 *
 * 1. **Refresh the session.**  Supabase tokens expire; this hook runs on
 *    every request and is the one place a refreshed token can be written back
 *    as a cookie before rendering starts.
 * 2. **Redirect, optimistically, in one direction only.**
 *
 * ## Why one direction
 *
 * A missing or unreadable cookie means definitely signed out, so sending that
 * request to `/login` is always right.
 *
 * The reverse is not. A cookie can outlive the session behind it — revoked,
 * expired, a password changed on another machine — so "has a cookie" does not
 * mean "is signed in". A proxy that waved a cookie-holder through to the
 * dashboard would disagree with the page's own check the moment the two
 * differed, and the browser would bounce between them until it gave up. So
 * this never redirects *toward* the dashboard.
 *
 * ## Why it is not the authorisation check
 *
 * It cannot be. Being signed in is not being staff: `operators` decides that, and
 * the decision is made inside the database on every policy and every RPC
 * (migrations 0062–0068). If this file were deleted, a stranger would gain
 * nothing but a redirect they could have followed themselves — every query
 * they made would still return nothing. That is the property worth having, and
 * it is why this file is allowed to be optimistic.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { supabaseUrl, supabaseAnonKey } = readEnv();
  const remember = request.cookies.get(REMEMBER_COOKIE)?.value === '1';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, withRememberMe((options ?? {}) as CookieOptions, remember));
        }
      },
    },
  });

  // Revalidates the token and refreshes it if needed. `getUser` rather than
  // `getSession`, because a session read out of a cookie proves only that the
  // cookie exists.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    // So signing in lands where they were going, rather than on the queue.
    login.searchParams.set('next', path + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  return response;
}

/** Reachable signed out. Everything else is not. */
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth'];

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets and the favicon. Static files do not
     * need a session refresh, and running this on each of them would triple the
     * auth requests a page load makes.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
};
