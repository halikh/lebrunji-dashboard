import { NextResponse, type NextRequest } from "next/server";

import { bridgeCookies } from "@/lib/auth/request-cookies";
import { currentAccessToken } from "@/lib/auth/session";

/**
 * Hands the browser an access token, refreshing first if the old one is spent.
 *
 * This is the only way the page ever obtains a token, and it is what lets the
 * refresh token stay `HttpOnly`: the browser asks for the short-lived half and
 * the server keeps the long-lived one.
 *
 * ## What an attacker gets from this endpoint
 *
 * Worth being exact, because it is the honest limit of the whole design. Script
 * running on this origin can call this and get an access token — a same-site
 * request carries the cookies with it. So an XSS can act as the operator for as
 * long as the page is open.
 *
 * What it cannot do is take away something that still works tomorrow. There is
 * no refresh token in the page to steal, so the attacker's access ends with the
 * tab. That is the whole of what the split buys, and it is worth having: the
 * difference between losing a session and losing the business.
 */
export async function GET(request: NextRequest) {
  // Built first so the cookie jar exists for a rotation to be written into.
  const response = NextResponse.json(
    { accessToken: null, expiresAt: null },
    // A token must never be written to a shared cache, nor kept on disk.
    { headers: { "cache-control": "no-store, private" } },
  );

  const { accessToken, expiresAt } = await currentAccessToken(
    bridgeCookies(request, response),
    { write: true, isSecure: request.nextUrl.protocol === "https:" },
  );

  // Rebuilt onto the *same* headers, so any Set-Cookie from the rotation above
  // survives. Returning a fresh NextResponse here would silently drop it, and
  // the next request would refresh again with an already-spent token.
  return new NextResponse(JSON.stringify({ accessToken, expiresAt }), {
    status: accessToken ? 200 : 401,
    headers: response.headers,
  });
}
