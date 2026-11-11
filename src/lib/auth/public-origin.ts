import type { NextRequest } from "next/server";

/**
 * This deployment's own address, for links that go out in an email. It is
 * never the request's `Host`.
 *
 * Anybody can post with any `Host` header they like. Built from the request,
 * an emailed link would land on whatever origin the caller named, carrying
 * the code it exists to deliver, unless Supabase's redirect allow-list
 * happened to catch it. That list is one setting in a hosted dashboard, and
 * nothing here can check it is right.
 *
 * Used by the recovery link (`/auth/reset-request`) and the email-change
 * confirmation (`/auth/account`).
 *
 * Production refuses rather than falling back, for the reason `imageUrlFor`
 * gives. Development uses the request's origin, which there is the real one.
 */
export function publicOrigin(request: NextRequest): string {
  const configured = (process.env.APP_PUBLIC_URL ?? "").replace(/\/+$/, "");
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_PUBLIC_URL is not set. Emailed links are built from it, " +
        "and the request's own Host is whatever the caller chose to send.",
    );
  }
  return request.nextUrl.origin;
}
