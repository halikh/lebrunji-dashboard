import { NextResponse, type NextRequest } from "next/server";

import { anonymousClient } from "@/lib/auth/session";

/**
 * Asks Supabase to email a recovery link.
 *
 * ## The response never varies
 *
 * Success is reported whether or not the address has an account, and the result
 * of the call below is deliberately discarded. This page is reachable signed
 * out by anyone; an honest error would turn it into a way of asking which email
 * address is the operator's.
 *
 * ## Nothing here mints a token
 *
 * The link, its single use and its expiry are all Supabase's. `redirectTo`
 * points at `/auth/confirm`, a route handler — not at a page — because the
 * exchange has to happen somewhere that can write `HttpOnly` cookies.
 */
export async function POST(request: NextRequest) {
  let email = "";
  try {
    const body: { email?: unknown } = await request.json();
    email = typeof body.email === "string" ? body.email.trim() : "";
  } catch {
    // Falls through to the same answer as everything else.
  }

  if (email) {
    const supabase = anonymousClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${publicOrigin(request)}/auth/confirm`,
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Where the link in the email points, and it is never the request's `Host`.
 *
 * Anybody can post here, with any `Host` header they like. Built from the
 * request, the operator's recovery link would land on whatever origin the
 * attacker named, carrying the code that resets the password, unless
 * Supabase's redirect allow-list happened to catch it. That list is one
 * setting in a hosted dashboard, and nothing here can check it is right.
 *
 * Production refuses rather than falling back, for the reason `imageUrlFor`
 * gives. Development uses the request's origin, which there is the real one.
 */
function publicOrigin(request: NextRequest): string {
  const configured = (process.env.APP_PUBLIC_URL ?? "").replace(/\/+$/, "");
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_PUBLIC_URL is not set. The password-reset link is built from it, " +
        "and the request's own Host is whatever the caller chose to send.",
    );
  }
  return request.nextUrl.origin;
}
