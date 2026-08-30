import { NextResponse, type NextRequest } from 'next/server';

import { REFRESH_COOKIE } from './lib/auth/cookies';
import { bridgeCookies } from './lib/auth/request-cookies';
import { currentAccessToken } from './lib/auth/session';

/**
 * Next 16 renamed this convention from `middleware.ts` to `proxy.ts`. The new
 * name is the more honest one: what follows is emphatically *not* where access
 * is decided.
 *
 * Two jobs, and it matters that it is only two.
 *
 * 1. **Keep the access token fresh.** This is the only place in a page request
 *    that can both read the refresh cookie and write a rotated one back — a
 *    server component may not set cookies. Doing it here means a page renders
 *    against a token that is already good, rather than each page discovering it
 *    is stale and being unable to do anything about it.
 *
 * 2. **Redirect, optimistically, in one direction only.**
 *
 * ## Why one direction
 *
 * No refresh cookie means definitely signed out, so sending that request to
 * `/login` is always right.
 *
 * The reverse is not. A cookie can outlive the session behind it — revoked,
 * expired, a password changed elsewhere — so "has a cookie" does not mean "is
 * signed in". A proxy that waved a cookie-holder through would disagree with
 * the page's own check the moment the two differed, and the browser would
 * bounce between them until it gave up. So this never redirects *toward* the
 * dashboard.
 *
 * ## Why it is not the authorisation check
 *
 * It cannot be. Being signed in is not being staff: `operators` decides that,
 * and the decision is made inside the database on every policy and every RPC
 * (migrations 0062–0068). If this file were deleted, a stranger would gain a
 * redirect they could have followed themselves — every query they made would
 * still return nothing. That property is why this file is allowed to be
 * optimistic.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  const response = NextResponse.next({ request });

  if (request.cookies.get(REFRESH_COOKIE)?.value) {
    // Refreshes only when the current token is spent; a valid one comes back
    // untouched, so this is not a round trip on every request.
    await currentAccessToken(bridgeCookies(request, response), {
      write: true,
      isSecure: request.nextUrl.protocol === 'https:',
    });
  }

  // Re-read rather than reusing the value above: a failed refresh clears both
  // cookies, and that is exactly the case that should now redirect instead of
  // rendering a dashboard whose every query is about to fail.
  const signedIn = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (!signedIn && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    // So signing in lands where they were going, rather than on the queue.
    login.searchParams.set('next', path + request.nextUrl.search);

    const redirect = NextResponse.redirect(login);
    // Carry the clearing across, or the dead cookies survive the redirect and
    // the next request repeats the whole failed refresh.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}

/**
 * Reachable signed out. `/auth` is on the list because the routes under it are
 * how somebody *becomes* signed in — gating them behind being signed in would
 * be a loop.
 */
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth'];

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets and the favicon. Static files need no
     * session, and running this on each of them would multiply the refresh
     * checks a single page load makes.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
};
