/**
 * A list row, once.
 *
 * Six lists were carrying the identical string —
 * `flex items-center gap-lg rounded-md border bg-surface px-lg py-md` — and
 * five of them had no hover state at all, which is exactly the decay the plan
 * warns about: *a convention that has to be repeated on every new control is
 * one that will be missed on the fourth.* The seventh list would have missed it
 * too.
 *
 * ## Why hover matters here specifically
 *
 * These rows are clickable, and most of them do not look it. The name inside is
 * an anchor stretched over the whole row (`after:absolute after:inset-0`), so
 * the cursor is right — but a cursor only tells you once you are already on it
 * and pointing. A row that responds says the whole strip is a target *before*
 * the pointer arrives, which is the difference between a list you scan and a
 * list you have to probe.
 *
 * ## It is a border, not a background
 *
 * A row's background is already carrying state: an archived or hidden row is
 * washed in `danger-wash/30`, and a row with the panel open on it wears a ring.
 * A hover that changed the background would either fight those or be invisible
 * on top of them. The border is the one channel that is free on every variant,
 * and `hover:` outranks the base `border-*` utility that each list sets
 * conditionally — so an inactive row still highlights, and an already-open row
 * is a no-op, which is correct: it is where you already are.
 *
 * ## The transition is declared here, and that is not a contradiction
 *
 * `globals.css` says no component should declare its own transition, because
 * one that did would *replace* the global rule rather than add to it. That rule
 * lists `a, button, input, select, textarea, summary, svg, [tabindex]` — and a
 * row is a `div`. It is not in the list, so nothing is being replaced; without
 * this the border would snap rather than fade, alone among every other hover in
 * the dashboard.
 */
export const ROW =
  "relative flex items-center gap-lg rounded-md border bg-surface px-lg py-md " +
  "transition-colors duration-[var(--duration-control)] hover:border-active";

/**
 * The same row, for a list whose rows do not lead anywhere.
 *
 * Worth having as a separate export rather than a flag: a hover state on
 * something that cannot be clicked is a promise the row does not keep, and it
 * is the kind of thing that gets added by copying the line above without
 * noticing which one it was.
 *
 * ## It carries its own border colour, and `ROW` does not
 *
 * Not an inconsistency. A `ROW` is in a list whose rows have *states* — hidden,
 * archived, open — so each caller sets `border-border` or a state colour, and a
 * default here would be a class every one of them has to beat. A static row has
 * no states by definition, so there is nothing to override and no caller to
 * remember.
 *
 * It was written without one, and the consequence was not subtle: `border` with
 * no colour falls back to `currentColor`, so the archive's rows came out
 * outlined in the near-black of their own text. A bare `border` is never what
 * anybody means.
 */
export const ROW_STATIC =
  "relative flex items-center gap-lg rounded-md border border-border " +
  "bg-surface px-lg py-md";

/**
 * What makes the **whole row** the target, applied to the thing inside it that
 * already opens the row — the name's link or button.
 *
 * ## Why this is a class and not a wrapper
 *
 * The hit area has to cover the row while the *control* stays the name, so the
 * accessible name is "Bakery" rather than "row" and there is exactly one tab
 * stop. `after:absolute after:inset-0` against `ROW`'s `relative` does that
 * with no extra element and no JavaScript. Wrapping the row in a button is the
 * obvious alternative and is not available: rows carry their own buttons — a
 * toggle, an archive, a drag handle — and a button inside a button is invalid
 * and behaves differently in every browser.
 *
 * ## Why it is here rather than written out per list
 *
 * `ROW`'s note above already describes this pattern as how these rows work,
 * and five lists implement it. The other eight never did, so their rows were
 * clickable only across the text in the middle — the artwork, the counts and
 * the gaps all did nothing, on rows whose border lights up on hover to say the
 * whole strip is a target. That is the decay this file was written about: a
 * convention repeated by hand is one the next list misses.
 *
 * Pair it with `ROW_ABOVE` on anything that must stay separately clickable.
 */
export const ROW_TARGET = "after:absolute after:inset-0 after:rounded-md";

/**
 * For a row's own controls, so the stretched target does not swallow them.
 *
 * An absolutely-positioned `::after` paints over in-flow siblings whatever
 * their order, so a toggle left static becomes unreachable the moment
 * `ROW_TARGET` is added — the row would open instead of the switch flipping.
 * Positioning them and lifting them one layer is what keeps both true.
 */
export const ROW_ABOVE = "relative z-10";
