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
 * The operator changing their own email or password, while signed in.
 *
 * ## Why this is not `/auth/update-password`
 *
 * That route sets a password for whoever the cookies say is signed in, and asks
 * for nothing else. That is correct where it is used: it runs after
 * `/auth/confirm` has consumed a recovery link, and **possession of the emailed
 * link is the proof**.
 *
 * A signed-in change has no such proof. The session by itself is not one — it
 * is exactly what an unattended laptop, or an XSS on this origin, already has.
 * Letting either of those set a new password turns a borrowed session into a
 * permanent takeover, and letting it set a new *email* hands over the recovery
 * route as well, which is worse: the real operator can no longer reset their
 * way back in.
 *
 * So both actions here re-authenticate with the current password first. It is
 * the one thing a stolen session does not carry.
 *
 * ## GET tells the form who it is editing
 *
 * The browser never sees a token, so it cannot read its own email out of one.
 * A `GET` here answers that and nothing else.
 *
 * ## Changing the email does not change the email
 *
 * `updateUser({ email })` starts a confirmation: Supabase mails the **new**
 * address and the change lands only when that link is followed. So the honest
 * reply is "check your email", not "done" — and the account screen says so
 * rather than showing an address that is not yet in effect.
 */

/** Who is signed in. */
export async function GET(request: NextRequest) {
  const session = await sessionFrom(request);
  if ("error" in session) return session.error;

  const { data } = await session.supabase.auth.getUser();
  return NextResponse.json({ email: data.user?.email ?? null });
}

export async function POST(request: NextRequest) {
  const session = await sessionFrom(request);
  if ("error" in session) return session.error;
  const { supabase } = session;

  let body: {
    current?: unknown;
    password?: unknown;
    email?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const current = typeof body.current === "string" ? body.current : "";
  const password = typeof body.password === "string" ? body.password : null;
  const email = typeof body.email === "string" ? body.email.trim() : null;

  if (!password && !email) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // The new password is judged before the current one is spent. Both the form
  // and this route apply `validatePassword`; this is the side that counts,
  // because a POST here does not have to come from the form.
  if (password) {
    const strong = validatePassword(password);
    if (!strong.ok) {
      return NextResponse.json(
        { error: t(strong.key, strong.params) },
        { status: 400 },
      );
    }
  }

  const { data: who } = await supabase.auth.getUser();
  const signedInAs = who.user?.email;
  if (!signedInAs) {
    return NextResponse.json({ error: "expired" }, { status: 401 });
  }

  // ---- the re-authentication, which is the point of this route -------------
  //
  // A fresh sign-in with the *current* password. It also rotates the session,
  // which is why the pair is written back at the end: succeeding must not sign
  // the operator out.
  const { error: wrongPassword } = await supabase.auth.signInWithPassword({
    email: signedInAs,
    password: current,
  });

  if (wrongPassword) {
    // Said plainly, and not collapsed into "something went wrong". This is not
    // the sign-in form, where separating "no such account" from "wrong
    // password" would turn it into an account-existence oracle — the account is
    // already known here, and the only thing being reported is that this
    // particular password is not it.
    return NextResponse.json(
      { error: t("account.wrongPassword") },
      { status: 403 },
    );
  }

  const { error } = await supabase.auth.updateUser(
    password ? { password } : { email: email as string },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const response = NextResponse.json({
    ok: true,
    // An email change is pending until the new address is confirmed, so the
    // screen has to say something different from "saved".
    pending: Boolean(email),
  });

  // The pair the re-auth and the update issued between them. Without this the
  // operator is signed out by the act of succeeding — a password change
  // invalidates the tokens that existed before it.
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

/**
 * A Supabase client carrying the caller's session, or the refusal to send back.
 *
 * The refresh cookie is `HttpOnly`, so this is the only side that can read it —
 * which is the whole architecture: the browser posts an intention and is told
 * whether it worked.
 */
async function sessionFrom(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return {
      error: NextResponse.json({ error: "expired" }, { status: 401 }),
    } as const;
  }

  const supabase = anonymousClient();
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    return {
      error: NextResponse.json({ error: "expired" }, { status: 401 }),
    } as const;
  }

  await supabase.auth.setSession(data.session);
  return { supabase } as const;
}
