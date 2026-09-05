"use client";

import type { ReactNode } from "react";

import { SearchInput } from "./search-input";

/**
 * The bar at the top of a list screen: a heading, a search box, an action.
 *
 * ## Why it is one component
 *
 * There were six of these, and every one carried a comment saying it was the
 * same bar as the others — "same border, same padding, same place for the box".
 * They were the same until they were not: the three that grew a line of help
 * under the box drifted out of alignment, and the three without it did not, so
 * the claim in the comments stopped being true without anyone editing a word of
 * them. A sentence asserting that two files agree is not a mechanism for making
 * them agree.
 *
 * ## The alignment, which is the thing that broke
 *
 * A row and a column are the wrong shape for this. The bar was
 * `flex items-start` with the search box and its hint in a nested column, so
 * the column was taller than the box — and the heading, told to centre itself,
 * centred on **box plus hint** and came to rest below the middle of the box it
 * was supposed to sit beside. The more helpful the screen was, the more crooked
 * its title.
 *
 * A grid says the real relationship instead. The heading, the box and the
 * action share one row and are centred on **each other**; the hint drops into
 * the second row of the box's own column, so it stays under the box and stops
 * having an opinion about the heading. Adding or removing a hint now cannot
 * move anything else.
 */
export function ListHeader({
  title,
  search,
  hint,
  action,
}: {
  title: string;
  search: {
    value: string;
    onChange: (value: string) => void;
    /** Also the accessible name — a search box rarely has a visible label. */
    placeholder: string;
  };
  /**
   * A standing note under the box.
   *
   * Always shown where a screen has one, rather than appearing once somebody
   * has typed: a drag handle that stops working is confusing at the moment it
   * stops, and the sentence is only useful before that.
   */
  hint?: string;
  /**
   * The screen's primary action.
   *
   * Optional, and its absence is not a gap: on the customers list the box *is*
   * the point — a customer is found by typing, not by scrolling — so the box
   * runs to the end of the bar. The column collapses to nothing rather than
   * leaving a strut where the most-used control should be.
   */
  action?: ReactNode;
}) {
  return (
    <div
      className={[
        "grid shrink-0 items-center border-b border-border bg-surface px-xxl py-lg",
        // Heading, box, action. The middle column takes the slack; `minmax(0,…)`
        // rather than a bare `1fr` so a long value in the box shrinks it instead
        // of pushing the action off the end.
        "grid-cols-[auto_minmax(0,1fr)_auto]",
        "gap-x-lg gap-y-xxs",
      ].join(" ")}
    >
      <h1 className="text-[24px]">{title}</h1>

      <SearchInput
        value={search.value}
        onChange={search.onChange}
        placeholder={search.placeholder}
      />

      {action}

      {hint && (
        // Second row of the box's column. `col-start-2` is what keeps it under
        // the box rather than under the heading, and the inset matches the one
        // `Field` uses so the sentence lines up with the text a person types
        // rather than with the border around it.
        <span className="col-start-2 ps-md text-[12px] text-text-faint">
          {hint}
        </span>
      )}
    </div>
  );
}
