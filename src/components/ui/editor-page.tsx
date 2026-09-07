"use client";

import type { ReactNode } from "react";

import { cx } from "./index";
import { BackLink } from "./back-link";

/**
 * The frame an editor wears now that it is a page rather than a panel.
 *
 * ## What it has to do that `Panel` did for free
 *
 * A panel is a `<dialog>`: it trapped focus, took Escape, returned focus to the
 * row that opened it, and made the page behind it inert. A page needs none of
 * that — it *is* the page — but it does need the two things the panel had that
 * a bare form does not: a title saying what is being edited, and an obvious way
 * back to the list.
 *
 * So this is `PanelHeader`'s job, done for a route. Written once because it was
 * written six times before and missing from two, which is how the settings
 * panels came to open with no title and no way out.
 *
 * ## The way back is a link, not a button
 *
 * `BackLink` is an anchor, so middle-click and ctrl-click still open the list in
 * a new tab and the status bar says where it goes. Those come free with a real
 * `href` and are silently lost the moment it becomes an `onClick` — which is
 * the whole reason moving off panels is worth doing.
 *
 * The `href` carries `?focus=` so the list scrolls back to this row. See
 * `useRowFocus`.
 *
 * ## The picture is a slot, not a prop for each kind of record
 *
 * A dish has one, a shop has one, a category does not. `media` takes whatever
 * the caller already draws in its own list, so the thumbnail beside the title
 * here is the same square the operator clicked on to get here.
 *
 * ## `width`, and what the cap is actually for
 *
 * `narrow` caps the scrolling column, and the reason is the *measure*: a name is
 * a short answer whatever the monitor is, and a text field a thousand pixels
 * wide is harder to read and harder to aim at.
 *
 * That is an argument about a **column**, though, and it was being applied to
 * the page. On a wide screen a 640pt column against 1700pt of monitor leaves a
 * form hugging the left edge with two thirds of the window empty — which reads
 * as a layout that failed rather than as one that was measured.
 *
 * `wide` takes the cap off entirely, for an editor that fills the width with
 * **columns** instead of with wider fields. The measure is then each column's
 * problem rather than the frame's, which is where it belongs: the editor knows
 * which of its fields are prose and which are short controls, and the frame does
 * not. Everything else stays `narrow`, which is the old behaviour to the pixel.
 *
 * ## The footer is the caller's
 *
 * Save and Cancel differ per editor — some have a delete, some a preview, one
 * has a currency warning that has to sit above the buttons — so the frame takes
 * them as a slot rather than growing a prop for each. What it owns is that they
 * are pinned: on a form long enough to scroll, Save must never be something you
 * have to go looking for.
 */
export function EditorPage({
  title,
  backHref,
  backLabel,
  children,
  footer,
  aside,
  media,
  meta,
  width = "narrow",
}: {
  /** What is being edited — the row's name, or "New category". */
  title: string;
  /** Where the list is, including `?focus=` when there is a row to return to. */
  backHref: string;
  backLabel: string;
  children: ReactNode;
  /** The buttons. Pinned to the foot; see the note. */
  footer?: ReactNode;
  /** A line under the title — a slug, a count, a warning. */
  aside?: ReactNode;
  /** A thumbnail beside the title. The record's own picture. */
  media?: ReactNode;
  /** A line above the title — what this record belongs to. */
  meta?: ReactNode;
  /**
   * How much of the window the fields may use — see the note above.
   *
   * `narrow` is one column at a readable measure and is right for almost every
   * editor. `wide` is for one that has enough fields to fill two.
   */
  width?: "narrow" | "wide";
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-md border-b border-border bg-surface px-xxl py-lg">
        <BackLink href={backHref}>{backLabel}</BackLink>

        <div className="flex min-w-0 items-center gap-lg">
          {media}

          <div className="flex min-w-0 flex-col gap-xxs">
            {meta}
            <h1 className="truncate text-[22px]">{title}</h1>
            {aside}
          </div>
        </div>
      </div>

      {/*
        The scrolling middle.

        `p-xxl` on the scroller rather than on a box around it: a scroll
        container clips what leaves it, and the focus ring is a box-shadow drawn
        a few pixels *outside* an input — with the padding one level up, the ring
        on the first field is sliced down its edge. The same reason
        `store-brand.tsx` records for its own column.
      */}
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        {/* See `width`: capped to a readable measure, or handed the whole
            width for an editor that divides it into columns of its own. */}
        <div
          className={cx(
            "flex w-full flex-col gap-lg",
            width === "narrow" && "max-w-[640px]",
          )}
        >
          {children}
        </div>
      </div>

      {footer && (
        /* `py-md` against the sides' `px-xxl`. The bar is pinned, so its height
           is height the form never gets back — and a row of buttons needs the
           gutter beside them far more than it needs air above and below. */
        <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border bg-surface px-xxl py-md">
          {footer}
        </div>
      )}
    </div>
  );
}
