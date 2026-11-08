# Working in lebrunji-admin

The admin dashboard for Lebrunji: a calm, professional work tool for the
people running the business. It replaces `c:\Projects\lebrunji-dashboard`
(kept running until this one is ready).

## What came from the old dashboard, and what did not

**Kept, unchanged in meaning:** everything that is data or rules —
`src/lib/**`, `src/features/*/api/**`, the `use-*.ts` hooks, `src/proxy.ts`,
`src/app/auth/**`, `src/app/api/**`, `src/app/i/**`, `scripts/`, and
`src/i18n/translations.ts`. Those carry many hard-won fixes (money rounding,
permission refusals, stale-write guards). Do not "simplify" them. If a screen
needs data a hook does not provide, add to the hook/api module, don't
bypass it.

**Not kept:** every screen and every UI component. The old `.tsx` screens in
`c:\Projects\lebrunji-dashboard\src\features\**` are the **spec for behaviour**
(what fields exist, what is validated, what confirmations are asked, what
edge cases are handled) — read them for that. Never copy their markup,
classes, layout or tokens (`text-text-soft`, `bg-neutral-fill`, `gap-lg`,
`shadow-card`, Playfair, ink buttons… none of those exist here).

## Permission model (unchanged)

The browser holds only the anon key and signs in as a real Supabase user;
RLS and `api_v1_*` RPCs decide everything. No service-role key, ever. If
something seems to need one, it needs a migration in `c:\Projects\lebrunji`.
The database lives in that repo; nothing here changes schema.

## Design system

Read `src/app/globals.css` (tokens) and `src/components/ui/` (kit) before
writing a screen. Import from `@/components/ui`.

- **Look:** neutral canvas (`bg-canvas`), white surfaces (`bg-surface`) with a
  hairline border (`border-line`) and `shadow-xs`. Text `text-ink`, secondary
  `text-ink-3`, faint `text-ink-4`. One accent (`accent`, standard blue-600) for
  the primary action and the current selection. Colour otherwise means
  something: `success`, `warning`, `danger`, `info`, and the order statuses.
- **Type:** Inter, 14px base. Page title 22px semibold (`PageHeader`); section
  title 15px semibold (`Section`); labels 13px medium; help text 12.5–13px
  `text-ink-3`. Numbers `tabular-nums`. No uppercase except sidebar group labels.
- **Pages:** wrap scrolling pages in `<Page>` (gutters + max width) and open
  with `<PageHeader title description actions back?>`. The shell does not
  scroll; the page does. Work queues (orders) use full-height split views
  instead.
- **Lists:** `Table/THead/TBody/Tr/Th/Td` for data with columns; a `divide-y`
  list of rows for people/things with an avatar. Toolbar above a list:
  `SearchInput` left, filters (`Segmented` or `Tabs`) and the primary action
  right. Always handle loading (`ListSkeleton`/`Skeleton`), error
  (`EmptyState` + Retry) and empty (`EmptyState` with a helpful sentence and
  the create action).
- **Editing:** forms are `Section` cards stacked in a single column
  (`Page width="narrow"` for create/edit pages), `Field` around every control
  (label above, hint/error below), primary Save at the bottom-right of a
  sticky footer or the page header. Small edits (a tag, a category, a driver's
  hours) open in a `Sheet` from the right instead of a new page. Destructive
  or customer-visible actions confirm with `ConfirmDialog` that says what will
  happen. Guard dirty forms with `useUnsavedChanges(dirty)` from
  `@/components/unsaved-changes`.
- **Feedback:** mutations already toast through the hooks (`useToasts`).
  Don't add a second toast.
- **Tabs inside a record** (a shop: Menu, Details, Branches, Options, Bundles,
  Hours, Archive) use `Tabs` with the tab in the URL (`?tab=`), `replace` not
  `push`.
- **Responsive:** must work from 360px to 1920px. Tables scroll sideways on
  phones or collapse to stacked rows; split views become a `Sheet` below `xl`.
- **RTL:** use logical classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`,
  `text-start`), never `ml-`/`left-`. Shop and dish names can be Arabic.

## Rules that are enforced

- **No literal text in JSX** — every string through `t()` from
  `@/i18n/translations`. Reuse existing keys where they fit. New keys:
  add them to `translations.ts` under the feature's existing namespace.
- **No machine clock** — dates and times only via `@/lib/time` or `useClock()`
  (`@/features/settings/use-clock`); the business clock is Beirut. Lint
  enforces this.
- **Money** only via `useMoney()` / `<Price>` (`@/features/reference`).
- Before finishing: `npx tsc --noEmit`, `npx eslint src` (0 errors),
  `npx vitest run`, `npx prettier --write "src/**/*.{ts,tsx,css}"`.

## Routes

`/` overview · `/orders` (+`/orders/[id]`) · `/todo` · `/shops`
(+`/shops/new`, `/shops/[storeId]?tab=`, `/shops/[storeId]/items/[itemId]`,
`/shops/[storeId]/items/new`, `/shops/[storeId]/branches/[branchId]`,
`/shops/[storeId]/branches/new`) · `/categories` · `/tags` · `/artworks` ·
`/archive` · `/promotions` · `/bundles` · `/customers` (+`/[id]`) ·
`/drivers` (+`/new`, `/[id]`) · `/pricing` · `/reports` · `/earnings` · `/settings`
(+`/settings/help/...`, `/settings/legal/...`) · `/account`.
The sidebar and command palette read `src/components/shell/nav.ts`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
