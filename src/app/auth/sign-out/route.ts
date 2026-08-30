import { NextResponse, type NextRequest } from "next/server";

import { REFRESH_COOKIE } from "@/lib/auth/cookies";
import { anonymousClient, clearSession } from "@/lib/auth/session";

/**
 * Ends the session on this browser, and revokes it at Supabase.
 *
 * Two halves, and both are needed. Clearing the cookies alone would leave a
 * refresh token that still works if it were ever recovered; revoking alone
 * would leave cookies that fail every request while the dashboard insists it is
 * signed in.
 *
 * ## `scope: 'local'`
 *
 * Supabase defaults to `global`, which revokes every refresh token the account
 * holds anywhere. That is right for "someone has my password" and wrong for a
 * sign-out button: pressing it on the counter machine would also sign the owner
 * out on their phone. Signing out everywhere is a different action.
 *
 * ## The cookies are cleared even when revocation fails
 *
 * A revoke can fail because the network is down or the token was already spent.
 * Neither is a reason to leave somebody signed in on a machine where they asked
 * not to be — the local half is the half they can see, so it always happens.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const isSecure = request.nextUrl.protocol === "https:";

  if (refreshToken) {
    try {
      const supabase = anonymousClient();
      const { data } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (data.session) {
        await supabase.auth.setSession(data.session);
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch {
      // Reported below by clearing regardless. See the note above.
    }
  }

  const response = NextResponse.json({ ok: true });
  clearSession(response.cookies, isSecure);
  return response;
}
