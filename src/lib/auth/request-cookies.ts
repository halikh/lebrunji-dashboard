import type { NextRequest, NextResponse } from 'next/server';

import type { CookieWriter } from './session';

/**
 * Reads from the request, writes to the response.
 *
 * Next gives these as two separate jars, and the distinction is easy to lose:
 * `response.cookies.get()` reads what *this response is about to set*, not what
 * the browser sent. Using it to look for an incoming refresh token finds
 * nothing, and the symptom is a dashboard that behaves exactly as if nobody
 * were signed in.
 *
 * So the bridge is explicit. Writes also go back into the request jar, so that
 * a second read within the same request sees the rotated token rather than the
 * spent one — which matters when a refresh happens in the proxy and the handler
 * after it reads again.
 */
export function bridgeCookies(request: NextRequest, response: NextResponse): CookieWriter {
  return {
    get(name) {
      const cookie = request.cookies.get(name);
      return cookie ? { value: cookie.value } : undefined;
    },
    set(name, value, attributes) {
      request.cookies.set(name, value);
      response.cookies.set(name, value, attributes);
    },
  };
}
