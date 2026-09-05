import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "./index";

/**
 * "Up a level", on every page that has one.
 *
 * ## One component, because there were four copies
 *
 * The store, the order, the customer and the driver each carried the same
 * twenty lines — the same chevron path, the same size, the same colour — and
 * one of them said so in a comment: *two spellings of "go up a level" are two
 * things to recognise.* Four copies is four chances for the fifth page to
 * spell it differently, so the spelling lives here now.
 *
 * ## It looks like a button and is still a link
 *
 * It used to be styled as one — blue, 13px, underlined on hover — and read as
 * incidental text above the heading rather than as the way back. So it wears a
 * button's ground and padding: a target with edges, which is what somebody
 * looking for the way out is looking for.
 *
 * ## And the ground is blue, not grey
 *
 * `primary-quiet` — the variant "Rename" wears, and every other quiet action in
 * the product. In this palette **blue is what can be acted on** and coral is
 * what to press next; grey is the ground for something with no opinion. A back
 * control has an opinion — it is the way out of the page — and on the sand fill
 * it read as chrome sitting above the heading rather than as a control.
 *
 * What it is *not* is a `<button>`. This navigates, so it stays an anchor:
 * middle-click, ctrl-click, right-click → open in a new tab, and the status bar
 * showing where it goes are all things a real link gives for free and a button
 * with an `onClick` silently takes away. "Button UI, link semantics" is the
 * combination that keeps both.
 *
 * The classes are `primary-quiet`'s, written out rather than borrowed from
 * `Button` — `Button` renders a `<button>` element, and there is no way to ask
 * it for an anchor without teaching it to be polymorphic for one caller.
 */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex w-fit shrink-0 items-center gap-xs whitespace-nowrap rounded-md",
        // The `primary-quiet` recipe, written out for the same reason the
        // sizes are: `Button` renders a `<button>`, and this has to stay an
        // anchor. See the note above.
        "bg-primary-wash px-md py-sm text-[14px] font-semibold text-primary",
        "hover:brightness-95",
        className,
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {children}
    </Link>
  );
}
