"use client";

import { createClient } from "@supabase/supabase-js";

import { readEnv } from "../env";

/**
 * The browser client. Anon key, and an access token held in memory only.
 *
 * ## Why this is not `createBrowserClient`
 *
 * `@supabase/ssr`'s browser client keeps the whole session — access token *and*
 * refresh token — in cookies that JavaScript can read, because it manages
 * refresh itself and needs the refresh token to do it. That is the ordinary
 * setup and it is what this project deliberately does not use: the refresh
 * token is the credential that keeps working after the laptop is closed, and it
 * should not be reachable from the page.
 *
 * Instead the `accessToken` option below is used. It exists for third-party
 * auth systems, and it fits this exactly: supabase-js stops managing sessions
 * altogether and simply asks a function for a token whenever it needs one —
 * for PostgREST requests, for Storage uploads, and for Realtime.
 *
 * ## The consequence, which is the point
 *
 * **`supabase.auth.*` throws when `accessToken` is set.** Signing in, signing
 * out and password reset therefore cannot be done from here even by accident;
 * they are route handlers under `/auth`, which is where they have to be for the
 * refresh token to stay `HttpOnly`. The library enforces the architecture.
 *
 * ## The honest limit
 *
 * An XSS on this origin can still call `/auth/token` and get a token — the
 * request carries the cookies. What it cannot do is take a credential that
 * outlives the tab. See `lib/auth/cookies.ts`.
 */

let client: ReturnType<typeof create> | null = null;

export function getClient() {
  client ??= create();
  return client;
}

function create() {
  const { supabaseUrl, supabaseAnonKey } = readEnv();

  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: getAccessToken,
  });
}

/** The token and when it dies, as `/auth/token` last reported them. */
let cached: { token: string; expiresAt: number } | null = null;

/**
 * One in-flight request, shared.
 *
 * The docs for `accessToken` warn that it "may be called concurrently and many
 * times" — a page load that fires four queries and opens a Realtime channel
 * calls it five times at once. Without this, that is five refreshes of a
 * rotating token, four of which race each other into using an already-spent
 * one, and the visible result is being signed out on load.
 */
let inFlight: Promise<string | null> | null = null;

/**
 * The current access token, refreshing it if it is close to expiry.
 *
 * Exported because Storage uploads do not go through supabase-js: it has no
 * progress reporting, and a five-megabyte image uploading behind a spinner that
 * says nothing is the state in which people press the button again. The upload
 * is an `XMLHttpRequest`, which does report progress, and it needs the same
 * token the client would have used.
 *
 * This exposes nothing the page could not already reach — the token is in
 * memory here by design, and the honest limit above is unchanged by naming it.
 */
export async function getAccessToken(): Promise<string | null> {
  // A minute of margin: a token valid for another two seconds is not worth
  // handing to a request that has to cross a network first.
  if (cached && cached.expiresAt - 60 > Math.floor(Date.now() / 1000)) {
    return cached.token;
  }

  inFlight ??= fetchAccessToken().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function fetchAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/auth/token", {
      // Same-origin so the HttpOnly cookies go with it, and `no-store` so a
      // token is never served from a cache.
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      cached = null;
      return null;
    }

    const body: { accessToken?: string | null; expiresAt?: number | null } =
      await response.json();

    if (!body.accessToken) {
      cached = null;
      return null;
    }

    cached = { token: body.accessToken, expiresAt: body.expiresAt ?? 0 };
    return cached.token;
  } catch {
    // Offline, most likely. Returning null makes the query fail rather than
    // hang, and the next attempt tries again.
    cached = null;
    return null;
  }
}

/**
 * Drops the cached token.
 *
 * Called after signing out, so a component that queries on its way out does not
 * do so with a token that was just revoked.
 */
export function forgetAccessToken() {
  cached = null;
  inFlight = null;
}
