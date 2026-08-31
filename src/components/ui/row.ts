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
 */
export const ROW_STATIC =
  "relative flex items-center gap-lg rounded-md border bg-surface px-lg py-md";
