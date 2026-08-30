"use client";

import { useEffect, useRef } from "react";

/**
 * Bringing something into view when it appears somewhere the operator is not
 * looking.
 *
 * ## Why this needs saying at all
 *
 * Every screen here pins a header and scrolls a list under it, so anything the
 * screen adds to the bottom of that list can appear entirely off-screen. The
 * click worked, the form is there, and the operator sees nothing happen — which
 * they read as the button being broken, and click again.
 *
 * It is the same failure the item editor already had from the other direction:
 * a validation message correctly attached to a field that had scrolled out of
 * sight. In both cases the thing existed and was simply somewhere nobody was
 * looking.
 *
 * ## The rule, for every screen
 *
 * **Anything that appears in response to a click, outside the viewport, is
 * scrolled to.** Adding a row at the end of a list, a form opening below the
 * fold, a validation message on a field further up, a newly expanded section.
 *
 * And the converse, which matters just as much: **nothing scrolls that the
 * operator did not ask to move.** A list that jumps because a realtime event
 * arrived, or because a query settled, takes the row they were reading out from
 * under them. This is for consequences of *their* action.
 *
 * ## The details that make it not annoying
 *
 * - **`nearest`, not `center`.** `center` scrolls even when the element is
 *   already fully visible, so a click on something in plain sight makes the
 *   page lurch for no reason. `nearest` does nothing when nothing is needed.
 * - **Focus with `preventScroll`.** Focusing usually scrolls too, and the two
 *   fight — the browser's jump lands first and the smooth one starts from
 *   somewhere unexpected. The scroll here is the one that runs.
 * - **`prefers-reduced-motion` is honoured**, and honoured by *arriving*
 *   rather than by not going: someone who asked for less motion still needs to
 *   be shown the form. The journey is skipped, not the destination.
 */
export function reveal(
  element: HTMLElement | null | undefined,
  options: { block?: ScrollLogicalPosition; focus?: boolean } = {},
): void {
  if (!element) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  element.scrollIntoView({
    block: options.block ?? "nearest",
    behavior: reduced ? "auto" : "smooth",
  });

  if (options.focus) {
    // The control, not the wrapper. Landing on a `div` says nothing; landing in
    // the first field means the operator can simply start typing, and a screen
    // reader reads the label and any hint tied to it.
    const target = element.matches(FOCUSABLE)
      ? element
      : element.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus({ preventScroll: true });
  }
}

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]';

/**
 * The same thing, for something that has just been rendered.
 *
 * Attach the returned ref to the element that appeared. It runs once, on mount,
 * which is exactly right for a form that is only rendered while it is open —
 * mounting *is* the appearing.
 */
export function useRevealOnMount<T extends HTMLElement>(
  options: { block?: ScrollLogicalPosition; focus?: boolean } = {},
) {
  const node = useRef<T>(null);
  const { block, focus } = options;

  useEffect(() => {
    reveal(node.current, { block, focus });
    // Once. A form that re-rendered because somebody typed in it should not
    // scroll itself back into view — they are already there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return node;
}
