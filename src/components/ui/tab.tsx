"use client";

import { cx } from "./index";

/**
 * How a tone is expressed on a tab: the selected ground, its ink, and the dot.
 *
 * CSS custom properties rather than class names, because the order-status ramp
 * is generated per status (`--color-status-<slug>-wash`) and a class name built
 * at runtime is one Tailwind never sees and therefore never generates.
 */
export type TabTone = { wash: string; ink: string; dot: string };

/**
 * One **filter** tab: which subset of a list is on screen.
 *
 * There are two tab idioms in this dashboard and they are not
 * interchangeable — see {@link SectionTab} for the other one, and the note
 * there for why the difference is worth two components.
 *
 * ## Why this is a primitive now and was not before
 *
 * It began inside the order queue, and the note there said lifting it out was
 * the right move "the moment a third screen wants one" — two call sites is not
 * enough to design a shared component around, and guessing its shape early
 * fixes the wrong seam. The customers list and the customer profile are the
 * third and fourth, so here it is, with the shape three real users agreed on
 * rather than one imagined one.
 *
 * ## The dot is on every tab, selected or not
 *
 * Colour alone is not a distinction a colour-blind operator can rely on, and
 * the dot is what ties a tab to the chips in the rows beneath it: the strip is
 * a legend, not decoration. A tab with no tone — "All", which is not a state —
 * keeps the app's coral and has no dot to give.
 *
 * ## Only the selected tab is in the tab order
 *
 * `tabIndex={-1}` on the rest, arrows to move between them. That is what stops
 * a four-tab strip costing four keyboard stops on the way to the content, every
 * single time.
 */
export function FilterTab({
  label,
  count,
  active,
  tone,
  onClick,
  onKeyDown,
}: {
  label: string;
  /**
   * How many rows are in the set behind it.
   *
   * Zero is not drawn: a tab reading "Suspended 0" states a fact nobody asked
   * for, and a strip of zeroes buries the counts that mean something.
   */
  count?: number;
  active: boolean;
  tone?: TabTone;
  onClick: () => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={
        active && tone ? { background: tone.wash, color: tone.ink } : undefined
      }
      className={cx(
        // 15px and a deeper pad. A tab strip is the coarsest navigation on a
        // screen and it was set at the size of a hint — small enough that the
        // selected one had to be found rather than seen, and a small target for
        // something pressed on the way into every task.
        "flex shrink-0 items-center gap-sm whitespace-nowrap rounded-t-md px-lg py-md text-[15px] font-semibold",
        active && !tone && "bg-active-wash text-active-ink",
        !active && "text-text-soft hover:bg-neutral-fill",
      )}
    >
      {tone && (
        <span
          aria-hidden
          className="size-[7px] shrink-0 rounded-full"
          style={{ background: tone.dot }}
        />
      )}
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cx("tabular-nums", active ? "font-bold" : "font-medium")}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Arrow-key movement across a strip, so every tab list behaves the same.
 *
 * Wrapping at both ends, because a strip that stops at its edges makes the
 * operator reverse direction to reach the tab one step the other way.
 */
export function tabArrowHandler<T>(
  keys: readonly T[],
  current: T,
  go: (next: T) => void,
) {
  return (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const at = keys.indexOf(current);
    const step = event.key === "ArrowRight" ? 1 : -1;
    go(keys[(at + step + keys.length) % keys.length]);
  };
}

/**
 * One **section** tab: which part of one record is on screen.
 *
 * ## Why this is a different component and not a prop
 *
 * A {@link FilterTab} asks *which of these rows*, and it is answering about a
 * set — so it carries a count, wears the colour of the state it selects, and
 * sits in a raised strip that reads as a set of buckets. A section tab asks
 * *which part of this thing*, where there is one subject and the tabs are its
 * chapters; a count would be noise on "Details" and a colour would imply a
 * status that a chapter does not have.
 *
 * Drawing them the same way would say the two questions are the same question.
 * They look different on purpose: the store screen's Menu / Details / Options /
 * Hours are chapters, and the order queue's status strip is buckets.
 *
 * So this is the underline — quieter, no ground, no dot — exactly as the store
 * screen draws it. The keyboard behaviour is identical, because that part *is*
 * the same question.
 */
export function SectionTab({
  label,
  active,
  onClick,
  onKeyDown,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      // Only the selected tab is in the tab order; the arrows move between
      // them. That is what stops a four-tab strip costing four keyboard stops
      // on the way to the content, every time.
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cx(
        // The same bump `FilterTab` took, and it has to be the same: the two
        // idioms sit on different screens but a customer profile and a store
        // page should not disagree about how big a tab is.
        "border-b-2 pb-md text-[15px] font-semibold",
        active
          ? "border-active text-text"
          : "border-transparent text-text-soft hover:text-text",
      )}
    >
      {label}
    </button>
  );
}
