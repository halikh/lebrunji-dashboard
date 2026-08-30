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
| **Where they live** | **Split.** The refresh token and the current access token are `HttpOnly` cookies the browser cannot read. The page holds an access token in memory only, fetched from `/auth/token`. |
| **Refresh** | `src/proxy.ts` on every matched page request, and `/auth/token` when the browser needs one. Both go through `currentAccessToken`, the single place a rotation happens. |
| **Reset** | Supabase's recovery flow over Resend SMTP. The link points at `/auth/confirm` — a route handler, not a page — because the exchange produces a refresh token, and that has to be written as an `HttpOnly` cookie by something the browser cannot see. |
| **Sign-out** | `/auth/sign-out` revokes at Supabase (`scope: 'local'`) and clears the cookies. It clears them even if the revoke fails: neither a dead network nor a spent token is a reason to leave somebody signed in on a machine where they asked not to be. |
| **Remember me** | A cookie *lifetime*, not a token lifetime. Ticked, the auth cookies get a 30-day `Max-Age`; cleared, they get none and die with the window. It does not shorten the refresh token, which has its own server-side life. |

### `getUser()`, never `getSession()`

`getSession` reads a token and decodes it. `getUser` asks the auth server.
Anything deciding what to render uses the second, because the first proves only
that a well-formed token exists — it would not notice a revoked session, and a
revoked session is exactly the case worth noticing.

### The split, and what it actually buys

The ordinary Supabase browser setup keeps both tokens where JavaScript can read
them, because the client manages refresh itself and needs the refresh token to
do it. This app does not use that client.

Instead the browser client is built with supabase-js's `accessToken` option —
intended for third-party auth systems, and an exact fit here. supabase-js stops
managing sessions and simply asks a function for a token whenever it needs one:
for PostgREST, for Storage, and for Realtime. **A consequence worth stating,
because it is load-bearing: `supabase.auth.*` throws when that option is set.**
Signing in, signing out and password reset therefore cannot happen in the
browser even by accident. They are route handlers under `/auth`. The library
enforces the architecture rather than a convention doing it.

What this buys, precisely:

- An XSS on this origin **can** still call `/auth/token` and get an access
  token — a same-origin request carries the cookies. It can act as the operator
  for as long as the page is open.
- What it **cannot** do is take away a credential that still works tomorrow.
  There is no refresh token in the page to steal.

That is the difference between losing a session and losing the business. It is
not the same as being immune to XSS, and nothing here should be read as
claiming that.

### Why not go further

Routing *every* authenticated call through server actions would give better
isolation still. It would also remove the live order queue's Realtime
subscription and direct-to-Storage image upload, which are two of the things the
dashboard is built around. The split above is the point on that curve where the
cost is a few route handlers rather than a different product.

### Project settings that are part of this, and are not in this repo

Two of the protections below cannot live in application code, because the auth
endpoint is reachable without going through this app — a rule enforced only here
is a rule an attacker skips by not using the dashboard. They are project
settings, and they have to be set once per Supabase project.

**Authentication → Rate Limits**

| Setting | Value | Why |
| --- | --- | --- |
| Sign in / sign up | 10 per 5 minutes per IP | This is the brute-force ceiling. There is one account, and a person signing in gets it right in two or three attempts; ten is generous for them and useless for a guessing attack. |
| Password reset emails | 4 per hour | Also the outbound-mail cost. Nobody legitimately needs a fifth reset link in an hour. |
| Token refreshes | leave at the default | Lower it and a busy dashboard signs itself out. |

**Authentication → Policies (password)**

| Setting | Value | Why |
| --- | --- | --- |
| Minimum length | 12 | Matches `PASSWORD.min` in `src/lib/limits.ts`. If the two disagree, the form accepts what the server then refuses. |
| Required characters | none | Deliberate. Composition rules push people to `Password1!` — every class satisfied, guessed instantly — and refuse long passphrases that are far stronger. Length is what costs an attacker. |
| Leaked password protection | on | Checks against HaveIBeenPwned. This is the real breach check; `validatePassword` only refuses a handful of obvious words, and does not pretend otherwise. |

What *is* in this repo is the layer that can explain: `validatePassword` in
`src/lib/validation.ts`, applied by both the reset screen and `create-admin`, so
a password one accepts is one the other would have accepted. It is not the gate.

### Still not implemented, and why

- **A sign-in audit trail.** Supabase already records auth events in
  `auth.audit_log_entries`. If this ever needs to be visible to the operator it
  should read those rather than keep a second, divergent copy — and it needs a
  settings screen to live in, which does not exist yet.
- **Client-side lockout after N failed attempts.** It would be theatre: state
  held in the browser is cleared by reloading the page. The rate limit above is
  the real version of this, applied where it cannot be skipped.

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
