# lebrunji-dashboard

The operator's tool for [lebrunji](https://github.com/halikh/lebrunji) — the
web app the person running the business signs into to work orders, edit the
menu, set delivery prices and read the numbers.

It is a separate repo from the app on purpose, and it is built from scratch: no
components, flows or conventions are carried over from any other dashboard.

## Get started

1. Install

   ```bash
   npm install
   ```

2. Configure

   ```bash
   cp .env.example .env.local
   ```

   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are all the
   app needs; `src/lib/env.ts` validates them at startup and reports everything
   missing at once.

   The file has two more slots that only the scripts read, and neither is a
   copy of anything above it:

   - `SUPABASE_SERVICE_ROLE_KEY` — a **different key** from the anon key, not
     the same one renamed. In Supabase's current format both start with `sb_`,
     which makes them look interchangeable: `sb_publishable_...` is the anon
     key, `sb_secret_...` is this one. The anon key gets a 401 from the admin
     API and cannot write to `operators`, so substituting it fails on the first
     call. It carries no `NEXT_PUBLIC_` prefix because that prefix means
     *inlined into the browser bundle*, and this key bypasses RLS entirely.
   - `SUPABASE_DB_URL` — only for `npm run check:limits`.

   The project URL is **not** repeated: the scripts read
   `NEXT_PUBLIC_SUPABASE_URL`. `SUPABASE_URL` still overrides it if set, so a
   script can be pointed at another project, but nothing requires it.

3. Create the one admin account, once

   ```bash
   npm run create-admin you@example.com
   ```

   This is the only thing that ever uses the service-role key, and it reads it
   from `.env.local` on your machine. See below.

   The scripts are plain Node, not Next, so they load `.env.local` themselves —
   `scripts/load-env.ts`. Worth knowing, because it is easy to assume Node reads
   that file and then be confused by a script reporting a variable that is
   plainly sitting in it.

4. Run

   ```bash
   npm run dev
   ```

## How permission works, in one page

**The database decides. This app holds only the anon key.**

The dashboard signs in as a real Supabase user whose id is a row in `operators`.
That row carries a `role`; today there is one, `admin`.
Every capability it has is either an RLS policy or a `security definer` function
gated on `is_admin()` — migrations 0062 to 0068 in the app repo. Nothing is
granted by this codebase.

That has three consequences worth knowing before changing anything here:

- **There is no service-role key in this app**, in its environment, or on
  Vercel. A service-role key bypasses RLS completely, which would make every
  policy in those migrations irrelevant and move the decision into whatever this
  app remembered to check. It is used once, locally, by `scripts/create-admin.ts`.
- **There is no privileged API route to protect.** Reads, writes, Realtime and
  Storage uploads all go straight from the browser. A server hop would add a
  second place to get authorisation right without adding any authorisation.
- **`src/proxy.ts` is not the access check.** It redirects a request with no
  cookie to `/login`, and never the other way — a cookie can outlive the session
  behind it. Delete that file and a stranger gains a redirect they could have
  followed anyway; every query they made would still return nothing.

If you find yourself wanting a service-role key to make something work, the
thing to add is a policy or an `api_v1_*` function in the app repo's
`supabase/migrations/`, not a key here.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run verify` | Typecheck, lint and test — what CI runs |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm test` / `test:watch` | Vitest — pure logic only |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the linked project |
| `npm run check:limits` | Proves `src/lib/limits.ts` still matches the database |
| `npm run create-admin` | Creates the single operator account. Local only. |

### `check:limits` is not optional busywork

`src/lib/limits.ts` and migration 0066 hold the same numbers, which is two
sources of truth. That is tolerable only because this script proves they agree:
it reads the CHECK constraints back out of `pg_constraint` and fails on any
disagreement. Without it the two drift, and the drift is invisible in the worst
direction — a form confidently accepting something the database then refuses,
with the failure landing on the operator.

Run it after any migration that touches a limit.

## Conventions

- **The design system is the app's.** `src/app/theme.css` transcribes
  `src/theme/colors.ts` from the app — the same ramp, the same role names, the
  same measured contrast. No component names a colour; a hex literal or a bare
  `bg-blue-500` is a lint error. Blue is what can be acted on, coral is what to
  press next, and the mark's red `#e01f28` is never used for anything clickable.
- **One mode.** No dark pair, because the app has none and says why: the
  blue/sun/mint relationships that carry the meaning do not survive inversion.
  Everything is a token, so the seam is open.
- **Chrome is English; content is not.** Every string in the UI goes through
  `t()` in `src/i18n/translations.ts`, enforced by `react/jsx-no-literals` — so
  adding a language is a file to fill. Content is separate: the translated
  `jsonb` columns get one input per row in the `languages` table, so adding a
  content language is a database row and no code change at all.
- **Anything the form refuses, Postgres refuses too.** `src/lib/validation.ts`
  exists to produce a sentence a person can act on, not to be the gate. The gate
  is a CHECK constraint, a unique index, or a `raise` in an RPC. The importer
  uses this exact module, so a pasted value is judged by the rule a typed one is.

## Deploying

Vercel. Two environment variables, both `NEXT_PUBLIC_`. Add the deployed URL to
the Supabase Auth redirect allowlist — the password-reset link needs it. The app
repo's `ENVIRONMENTS.md` defines three Supabase projects; staging first.
