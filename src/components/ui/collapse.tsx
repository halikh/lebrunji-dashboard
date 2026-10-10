"use client";

import { useState, type ReactNode } from "react";

import { cx } from "./index";

/**
 * Content that opens and closes, without jumping.
 *
 * ## Why a grid and not a height
 *
 * The obvious way to animate this is to transition `height`, and it does not
 * work: `height: auto` is not an animatable value, so the only way to reach it
 * is to measure the content in JavaScript and write a pixel number — which is
 * then wrong the moment anything inside it reflows, and has to be re-measured
 * on every resize, font load and image.
 *
 * A grid whose single row goes from `0fr` to `1fr` animates the *fraction*
 * instead. The browser resolves the height itself, at every frame, from the
 * content it actually has. Nothing is measured and nothing goes stale.
 *
 * The inner `overflow-hidden` is load-bearing: the row is what shrinks, and
 * without it the content simply overflows a zero-height row and stays visible.
 *
 * ## Closed content stays in the DOM, so it is made `inert`
 *
 * It has to stay mounted — there is nothing to animate from otherwise, and
 * unmounting is what made every earlier version of this snap. But a control
 * that cannot be seen must not be reachable by Tab, and text that is clipped to
 * nothing should not be read out. `inert` says both in one attribute.
 *
 * `prefers-reduced-motion` is honoured by the global rule in `globals.css`,
 * which zeroes transition durations rather than removing this one by hand.
 *
 * ## It only clips while it moves
 *
 * The clip is what makes the fold work, and once the content is fully open it
 * is only harm: it cut the soft shadow off every card at the fold's edges, and
 * it stops a `sticky` heading inside from sticking, since sticky positions
 * against the nearest clipping box and this one never scrolls. So the clip is
 * lifted when the opening transition ends, and put back the moment it starts
 * to close. (`globals.css` shortens reduced-motion transitions to 0.01ms
 * rather than none, so `transitionend` still fires there.)
 */
export function Collapse({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  // Open and finished opening. Reset during render when `open` changes, so
  // the clip is back on the very frame a close starts.
  const [settled, setSettled] = useState(open);
  const [was, setWas] = useState(open);
  if (was !== open) {
    setWas(open);
    setSettled(false);
  }

  return (
    <div
      inert={!open}
      aria-hidden={!open}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && open) setSettled(true);
      }}
      className={cx(
        "grid transition-[grid-template-rows] duration-[var(--duration-expand)] ease-[var(--ease-arrive)]",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className,
      )}
    >
      <div className={cx("min-h-0", !(open && settled) && "overflow-hidden")}>
        {children}
      </div>
    </div>
  );
}
