/**
 * The two variables this app has, validated at the edge of startup.
 *
 * Reports everything missing at once rather than one per restart — the same
 * thing `src/config/env.ts` does in the app repo, for the same reason: the
 * second missing variable is discovered a minute after the first, and a minute
 * is long enough to have started debugging the wrong thing.
 *
 * ## There are only two, and that is the design
 *
 * The dashboard holds the **anon key** and nothing else. Its powers come from
 * being signed in as a real Supabase user whose id is in `operators` — every one
 * of them is an RLS policy or an `is_admin()`-gated RPC (migrations 0062–0068).
 *
 * So there is no service-role key here, on Vercel, or in any environment file
 * this app reads. A service-role key bypasses RLS entirely, which would make
 * every authorisation decision in the database irrelevant and move it into
 * whatever this app remembered to check. The one place it is used is
 * `scripts/create-admin.ts`, run once from a laptop, reading a gitignored
 * `.env.local` that is never deployed.
 *
 * `NEXT_PUBLIC_` means **inlined into the bundle and readable by anyone with
 * the URL**. That is correct for a hostname and for a key whose security model
 * is Row-Level Security. It is correct for nothing else, ever.
 */

type Env = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

/**
 * Read as separate literal property accesses, not through a loop or a variable
 * key. Next.js replaces `process.env.NEXT_PUBLIC_*` at build time by textual
 * substitution, so a computed lookup finds nothing in the browser bundle.
 */
const raw = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const LABELS: Record<keyof Env, string> = {
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  supabaseAnonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
};

export function readEnv(): Env {
  const missing = (Object.keys(LABELS) as (keyof Env)[]).filter(
    (key) => (raw[key] ?? "").length === 0,
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing environment ${missing.length === 1 ? "variable" : "variables"}: ` +
        `${missing.map((key) => LABELS[key]).join(", ")}. ` +
        "Copy .env.example to .env.local and fill them in.",
    );
  }

  return {
    supabaseUrl: raw.supabaseUrl as string,
    supabaseAnonKey: raw.supabaseAnonKey as string,
  };
}
