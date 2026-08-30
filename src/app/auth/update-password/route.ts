import { NextResponse, type NextRequest } from "next/server";

import { REFRESH_COOKIE } from "@/lib/auth/cookies";
import {
  anonymousClient,
  readRemember,
  toPair,
  writeSession,
} from "@/lib/auth/session";
import { t } from "@/i18n/translations";
import { validatePassword } from "@/lib/validation";

/**
 * Sets a new password for whoever the cookies say is signed in.
 *
 * The session comes from the `HttpOnly` refresh cookie — usually one written
 * moments earlier by `/auth/confirm` from a recovery link. The browser never
 * sees it, and never has to: it posts a password and is told whether it worked.
 *
 * ## The rule is applied here as well as in the form
 *
 * `validatePassword` runs on both sides, and this is the side that counts. The
 * form's copy exists to explain before a round trip; this one exists because a
 * POST to this endpoint does not have to come from the form.
 *
 * It is still not the last word — the project's password policy is, since the
 * auth endpoint is reachable without going through this app at all.
 *
 * ## Why the session is rewritten afterwards
 *
 * Changing a password issues new tokens and invalidates the old ones. Without
 * writing the new pair back, the operator would be signed out by the very act
 * of succeeding.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken)
    return NextResponse.json({ error: "expired" }, { status: 401 });

  let password = "";
  try {
    const body: { password?: unknown } = await request.json();
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const strong = validatePassword(password);
  if (!strong.ok) {
    // Translated here, on the server, because the route answers a request that
    // did not have to come from the form — a client posting directly gets a
    // sentence rather than a key it has no bundle for.
    return NextResponse.json(
      { error: t(strong.key, strong.params) },
      { status: 400 },
    );
  }

  const supabase = anonymousClient();

  const { data: refreshed, error: refreshError } =
    await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });
  if (refreshError || !refreshed.session) {
    return NextResponse.json({ error: "expired" }, { status: 401 });
  }

  await supabase.auth.setSession(refreshed.session);

  const { data, error } = await supabase.auth.updateUser({ password });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  const response = NextResponse.json({
    ok: true,
    email: data.user?.email ?? null,
  });

  // The pair issued by the update, so success does not sign them out.
  const { data: after } = await supabase.auth.getSession();
  if (after.session) {
    writeSession(response.cookies, toPair(after.session), {
      remember: readRemember({
        get: (name) => {
          const cookie = request.cookies.get(name);
          return cookie ? { value: cookie.value } : undefined;
        },
        set: () => {},
      }),
      isSecure: request.nextUrl.protocol === "https:",
    });
  }

  return response;
}
