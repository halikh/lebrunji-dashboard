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

## Sessions, tokens, and what this app does not implement

Nearly all of it is Supabase Auth. That is the point — a hand-rolled session
layer is a large amount of security-critical code to get subtly wrong, and there
is nothing about this product that needs its own.

What is actually in play on a signed-in request:

| | |
| --- | --- |
| **Access token** | A short-lived JWT signed by the project, carrying `sub` (the user id). This is what RLS reads through `auth.uid()`, so it is the thing every policy in migrations 0062–0068 is deciding about. Default lifetime one hour, set in the Supabase dashboard. |
| **Refresh token** | Long-lived, rotating, single-use. Exchanged for a new access token when the old one expires. Reuse of a spent one revokes the family. |
| **Where they live** | Cookies, written by `@supabase/ssr`, chunked across `…auth-token.0`, `.1` when a token is too long for one cookie. `SameSite=Lax`, and `Secure` on https. |
| **Refresh** | `src/proxy.ts` calls `getUser()` on every matched request. That revalidates the token against the auth server — not merely decoding the cookie — and writes back a refreshed one when it has rotated. |
| **Reset** | Supabase's recovery flow: `resetPasswordForEmail` sends a single-use, time-limited link over Resend SMTP; `/reset-password` waits for the resulting `PASSWORD_RECOVERY` session before showing the form. No token table here, and nothing in this repo mints or validates one. |
| **Sign-out** | `signOut({ scope: 'local' })` — revokes this browser's refresh token and deletes the cookies, leaving other devices signed in. |
| **Remember me** | A cookie *lifetime*, not a token lifetime. Ticked, the session cookies get a 30-day `Max-Age`; cleared, they get none and die with the window. It does not shorten the refresh token, which has its own server-side life. |

### `getUser()`, never `getSession()`

`getSession` reads the cookie and decodes it. `getUser` asks the auth server.
Anything deciding what to render or whether to redirect uses the second one,
because the first proves only that a cookie exists — and a cookie outlives the
session behind it after a revocation, a password change, or an expiry.

### The real limitation: these cookies are not `HttpOnly`

`createBrowserClient` writes them with `document.cookie`, and JavaScript cannot
set `HttpOnly`. So a successful XSS in this app could read the access token.

That is inherent to a browser-side Supabase client, not an oversight, and the
alternative is worth naming so the trade is visible: routing every authenticated
call through server actions or route handlers, which would give `HttpOnly`
cookies and cost the two things this dashboard is built on — Realtime
subscriptions for the order queue, and direct-to-Storage uploads.

What limits the damage: the access token is short-lived and carries no more
authority than the operator has, every write it can make is still gated by RLS
and `is_admin()`, and the refresh token rotates. What would *not* limit it is a
service-role key, which is one more reason there is not one here.

### Not implemented here, on purpose

- **Login rate limiting and lockout.** Supabase Auth applies its own, configured
  per project under Authentication → Rate Limits. Doing it a second time in this
  app would be bypassable — the auth endpoint is reachable without going through
  this app at all.
- **Password strength rules.** The reset form asks for twelve characters, but
  the enforcing copy of that rule belongs in the project's password policy, for
  the same reason.
- **A sign-in audit trail.** Supabase records auth events; if this ever needs to
  be visible to the operator it should read those rather than keep its own.

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
