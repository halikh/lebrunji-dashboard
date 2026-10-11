import { NextResponse, type NextRequest } from "next/server";

import { requireOperator } from "@/lib/auth/operator";
import { readEnv } from "@/lib/env";
import { deleteObject, listObjects } from "@/lib/storage/bucket";
import { planSweep, type SweepPlan } from "@/lib/storage/sweep";

/**
 * Pictures in the bucket that nothing points at: how many (`GET`), and gone
 * (`POST`).
 *
 * The rules — what counts as unused, and when to refuse — are in
 * `lib/storage/sweep.ts`. This is the plumbing: list the bucket, ask the
 * database which keys its rows still hold, delete the difference.
 *
 * ## The order of the two reads is the safety, not a detail
 *
 * The bucket is listed **first**, the database asked **second**. A row saved
 * between the two reads is then seen by the second; the other way round, an
 * upload could be listed, saved onto a row, and deleted, all inside one sweep.
 * (The day of grace covers that too. Two guards for the one way this loses a
 * customer-facing picture.)
 *
 * ## `POST` decides again
 *
 * It does not take a list from the browser. The count on screen may be minutes
 * old, and a key list from a client is a list of anything it likes — the same
 * reason `DELETE /api/images` constrains its key's shape.
 */

type Answer =
  { ok: true; plan: SweepPlan } | { ok: false; response: NextResponse };

async function plan(token: string, carrier: NextResponse): Promise<Answer> {
  const objects = await listObjects();

  const { supabaseUrl, supabaseAnonKey } = readEnv();
  const lookup = await fetch(
    `${supabaseUrl}/rest/v1/rpc/api_v1_image_keys_in_use`,
    {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    },
  );

  if (!lookup.ok) {
    // 404: migration 0188 is not applied here yet. Without the list, every
    // object would look unused — so no answer is the only safe answer.
    const error =
      lookup.status === 404
        ? "not-ready"
        : lookup.status === 401 || lookup.status === 403
          ? "forbidden"
          : "failed";
    return {
      ok: false,
      response: NextResponse.json(
        { error },
        {
          status: error === "forbidden" ? 403 : 503,
          headers: carrier.headers,
        },
      ),
    };
  }

  const keys: unknown = await lookup.json();
  if (!Array.isArray(keys)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "failed" },
        { status: 503, headers: carrier.headers },
      ),
    };
  }

  return {
    ok: true,
    plan: planSweep({
      objects,
      inUse: new Set(keys.filter((key) => typeof key === "string")),
      now: new Date(),
    }),
  };
}

function refused(reason: string, carrier: NextResponse) {
  return NextResponse.json(
    { error: reason },
    { status: 409, headers: carrier.headers },
  );
}

export async function GET(request: NextRequest) {
  const carrier = NextResponse.json({});
  const check = await requireOperator(request, carrier);
  if (!check.ok) return check.response;

  const answer = await plan(check.token, carrier);
  if (!answer.ok) return answer.response;
  if (!answer.plan.ok) return refused(answer.plan.reason, carrier);

  const response = NextResponse.json(
    { count: answer.plan.unused.length, bytes: answer.plan.bytes },
    { headers: carrier.headers },
  );
  response.headers.set("cache-control", "no-store");
  return response;
}

/** At most this many deletes in flight — polite to the store, quick enough. */
const PARALLEL = 8;

export async function POST(request: NextRequest) {
  const carrier = NextResponse.json({});
  const check = await requireOperator(request, carrier);
  if (!check.ok) return check.response;

  const answer = await plan(check.token, carrier);
  if (!answer.ok) return answer.response;
  if (!answer.plan.ok) return refused(answer.plan.reason, carrier);

  const queue = [...answer.plan.unused];
  let deleted = 0;
  let bytes = 0;
  let failed = 0;

  // A failure is counted and skipped, not thrown: one object the store will not
  // delete should not strand the other hundred. The next sweep finds it again.
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      for (let object = queue.shift(); object; object = queue.shift()) {
        try {
          await deleteObject(object.key);
          deleted += 1;
          bytes += object.size;
        } catch {
          failed += 1;
        }
      }
    }),
  );

  return NextResponse.json(
    { deleted, bytes, failed },
    { headers: carrier.headers },
  );
}
