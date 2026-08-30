import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { anonymousClient, toPair, writeSession } from "@/lib/auth/session";

/**
 * Where a link from an email lands.
 *
 * The recovery mail carries a `token_hash`, which is exchanged **here** rather
 * than on a page, for one reason: the exchange produces a refresh token, and a
 * refresh token must never be handed to JavaScript. A route handler can write
 * `HttpOnly` cookies; a client component cannot.
 *
 * That is also why the link cannot simply point at `/reset-password`. It points
 * here, this handler establishes the session, and only then does the browser
 * get a page — which by then is signed in and has no idea how.
 *
 * ## Remember-me is off for a recovery session
 *
 * Somebody following a link out of their inbox has not been asked whether this
 * machine should stay signed in, and a password reset is disproportionately
 * likely to be happening on a machine that is not theirs. A session cookie is
 * the conservative reading of an unanswered question.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const failed = new URL("/reset-password?error=expired", url.origin);

  if (!tokenHash || !type) return NextResponse.redirect(failed);

  const supabase = anonymousClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  // A used or expired link is an ordinary thing to hit, not an alarm — these
  // are single-use and time-limited by design. The screen says so and offers
  // another.
  if (error || !data.session) return NextResponse.redirect(failed);

  const response = NextResponse.redirect(
    new URL("/reset-password", url.origin),
  );
  writeSession(response.cookies, toPair(data.session), {
    remember: false,
    isSecure: url.protocol === "https:",
  });

  return response;
}
