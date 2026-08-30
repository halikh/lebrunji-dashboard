# Working in this repo

Read [README.md](./README.md) first — it explains how permission works, and that
is the thing most likely to be got wrong here.

Three constraints that are not visible from the code alone.

## The database is the other repo

Every table, policy, function and constraint this app talks to lives in
`c:\Projects\lebrunji` under `supabase/migrations/`. Nothing here creates or
alters schema.

So a missing capability is almost never a missing feature in this codebase. If
the dashboard cannot do something, the usual cause is that no policy permits it,
and the fix is a migration in the app repo — followed by `supabase/verify.sql`,
which is the only thing that confirms a migration actually applied.

The admin layer is migrations **0062–0067**. `is_admin()` is the single seam
everything goes through.

## No service-role key. Ever.

Not in `.env`, not on Vercel, not in a server component, not "just for this one
thing". It bypasses RLS completely, and RLS is the whole of the authorisation
model — see the README.

The single exception is `scripts/create-admin.ts`, which runs on a laptop and
reads a gitignored `.env.local`.

If something seems to need it, what is actually needed is a policy or an
`api_v1_*` function in the app repo.

## Built from scratch, deliberately

Nothing is taken from `c:\Projects\glaze-dashboard` (a different product on
Prisma) or from any earlier `lebrunji-dashboard`. No copied components, no
copied CRUD engine, no copied flows.

The one thing this app *does* descend from is the lebrunji app itself — its
palette, type, mascot and wordmark, and its money and localisation helpers.
`src/app/theme.css` is a transcription of `src/theme/colors.ts`, and the values
in it are the design's. Do not re-pick them.

## Before committing

```bash
npm run verify        # typecheck, lint, test
npm run check:limits  # only if a limit or a constraint moved
```
