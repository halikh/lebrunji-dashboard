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
      redirectTo: `${request.nextUrl.origin}/auth/confirm`,
    });
  }

  return NextResponse.json({ ok: true });
}
