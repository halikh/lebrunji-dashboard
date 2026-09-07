/**
 * Building the `or=` filters a text search is made of.
 *
 * **Copied verbatim between the dashboard and the app**, save for where the
 * two numbers at the bottom come from — the arrangement `lib/money.ts` and
 * `lib/units.ts` describe, and for the same reason: both projects talk to one
 * PostgREST, and a term that is safe in one and not the other is a search that
 * works on a laptop and fails on a phone.
 *
 * ## The problem this exists for
 *
 * PostgREST's `or` takes its conditions as one **comma-separated string** —
 * `or=(name.ilike.%pizza%,slug.ilike.%pizza%)` — so the operator's typing ends
 * up inside a miniature query language. Every list in this dashboard built that
 * string by interpolation, which is right until somebody types a comma.
 *
 * `Ali, Beirut` becomes `name.ilike.%Ali`, ` Beirut%` — two conditions, the
 * second of which names no column. PostgREST rejects it, and the screen shows
 * "could not read" for a search that was merely punctuated. Parentheses do
 * worse: they open a group, so the failure moves around depending on what else
 * is in the term.
 *
 * ## The fix is quoting, which PostgREST documents
 *
 * A value wrapped in double quotes is read literally — commas, dots, colons and
 * parentheses included. Inside the quotes only `"` and `\` need escaping, and
 * they are escaped with a backslash.
 *
 * This is **not** an injection guard. The anon key and RLS decide what can be
 * read; a malformed filter is refused by PostgREST, not smuggled past it. What
 * it fixes is a class of honest failure: an operator whose search fails because
 * their shop is called "Ali, Beirut".
 *
 * ## What is deliberately not escaped
 *
 * `%` and `_` are LIKE's own wildcards and they are left alone, so typing
 * `50%` matches "50" followed by anything. Turning them off would need an
 * `ESCAPE` clause, which PostgREST does not expose — and an operator who types
 * a percent sign into a search box is far more likely to want a loose match
 * than a literal one.
 */

import { SEARCH } from "./limits";

/**
 * One `ilike` condition, with the term quoted so punctuation cannot break the
 * filter it lives in.
 *
 * `column` is trusted — it is written at the call site, never typed — and it is
 * where `->>` reaches inside a jsonb name: `matchesLike("name->>ar", term)`.
 */
export function matchesLike(column: string, term: string): string {
  const escaped = term.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${column}.ilike."%${escaped}%"`;
}

/**
 * The whole `or` argument for a term across several columns.
 *
 * Both languages of a translated name are always searched, at every call site
 * that has one: an operator who knows a shop as كبة should find it by typing
 * كبة, and a search that only reads `->>en` is one that works for half the
 * catalogue.
 */
export function likeAny(columns: readonly string[], term: string): string {
  return columns.map((column) => matchesLike(column, term)).join(",");
}

/**
 * The term a query should actually run with, or null for "no search".
 *
 * One place that decides what counts as a search, so `enabled:` on a hook and
 * the `if (term)` inside a fetch cannot disagree about it — which is the bug
 * where a list quietly fetches everything while the screen believes it is
 * showing matches.
 *
 * Below `SEARCH.minTerm` there is no search: a single letter matches most of
 * the catalogue, which is a round trip to tell somebody nothing. Above
 * `maxTerm` it is cut rather than refused — nobody means the four hundredth
 * character of a paste, and an error would be a worse answer than a match.
 */
export function searchTerm(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length < SEARCH.minTerm) return null;
  return trimmed.slice(0, SEARCH.maxTerm);
}
