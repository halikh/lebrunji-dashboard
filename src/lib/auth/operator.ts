import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { readEnv } from "@/lib/env";

import { bridgeCookies } from "./request-cookies";
import { currentAccessToken } from "./session";

/**
 * Is the caller the operator?
 *
 * ## This function exists because the bucket cannot answer it
 *
 * Every other write in this dashboard is authorised by Postgres. The browser
 * asks with its own token and a policy decides — which is the whole design, and
 * why a bug in this app cannot become a data breach.
 *
 * Object storage has no policies and no idea who a Supabase user is. The route
 * handlers hold a key that can do anything to the bucket, so **they** have to
 * decide, and a hand-written check is exactly the weaker second source of truth
 * the plan warns about. Two things keep it honest:
 *
 * - It is **one** function. A check repeated in three handlers is a check that
 *   will be subtly different in one of them, and the one that is wrong is the
 *   one nobody reads.
 * - It still asks the database. Rather than trusting a claim inside the JWT, it
 *   reads `operators` **as the caller**, so the answer comes from the same RLS
 *   policy that governs everything else. A revoked operator stops being one
 *   here at the same moment they stop being one everywhere.
 *
 * ## Signed in is not the same as authorised
 *
 * `0062`'s trigger fix means a stranger who signs up by email gets an
 * `authenticated` session and no `public.users` row. They are signed in. They
 * are not an operator, and the difference is the entire point of this check —
 * so the two cases are answered separately: 401 for no session, 403 for a
 * session that is not the operator's.
 */
export type OperatorCheck =
  { ok: true; token: string } | { ok: false; response: NextResponse };

export async function requireOperator(
  request: NextRequest,
  response: NextResponse,
): Promise<OperatorCheck> {
  const { accessToken } = await currentAccessToken(
    bridgeCookies(request, response),
    { write: true, isSecure: request.nextUrl.protocol === "https:" },
  );

  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "expired" },
        { status: 401, headers: response.headers },
      ),
    };
  }

  const { supabaseUrl, supabaseAnonKey } = readEnv();

  // `operators` has one policy: an operator may read their own row. So a row
  // coming back *is* the answer, and no row is the answer too — there is
  // nothing here that decides on the app's behalf.
  const lookup = await fetch(
    `${supabaseUrl}/rest/v1/operators?select=id&limit=1`,
    {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${accessToken}`,
      },
      // A permission decision must never come out of a cache.
      cache: "no-store",
    },
  );

  const rows: unknown = lookup.ok ? await lookup.json() : null;
  const isOperator = Array.isArray(rows) && rows.length > 0;

  if (!isOperator) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden" },
        { status: 403, headers: response.headers },
      ),
    };
  }

  return { ok: true, token: accessToken };
}
