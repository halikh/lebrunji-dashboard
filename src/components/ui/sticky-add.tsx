"use client";

import type { ReactNode } from "react";

import { cx } from "./index";
import { useOnScreen } from "./on-screen";

/**
 * "Add one" that stays within reach on a long list.
 *
 * Every list in this dashboard puts its add button at the end — where the new
 * thing is going to appear, which is the only place it means anything. On a
 * list that runs past a screen that button is then several screens away, and
 * scrolling to the bottom to add a row is a cost paid over and over on the day
 * a catalogue is being set up, which is exactly when it is used most.
 *
 * So there are two, and never both at once: the real one at the end of the
 * list, and a pinned copy that appears only while the real one is out of sight.
 *
 * ## Why sentinels rather than a scroll handler
 *
 * The question is only ever "can this be seen", which an `IntersectionObserver`
 * answers without running anything on every frame of a scroll. Two of them,
 * because two different things should suppress the bar:
 *
 * - **At the top**, the list is being read rather than added to, and a floating
 *   bar is a strip of chrome over the first row.
 * - **At the bottom**, the real button is already there, and two copies of one
 *   control on screen at once is worse than the inconvenience it fixes.
 *
 * ## It was written five times before it was written once
 *
 * The menu, promotions, help, legal, categories and tags each had their own
 * copy — and the plan's rule is that a value or behaviour appearing twice means
 * one of them is about to be wrong. The transition list, the `inert`, and which
 * of the two conditions suppresses the bar are all easy to get subtly different
 * and impossible to notice from one screen.
 */
export function useStickyAdd(enabled = true) {
  const [attachAddButton, addButtonOnScreen] = useOnScreen<HTMLDivElement>();
  const [attachTop, atTop] = useOnScreen<HTMLDivElement>();

  // Named `attach…` rather than `…Ref` because that is what they are:
  // `useOnScreen` hands back a **callback ref**, not a ref object, precisely so
  // it works on an element that is conditionally rendered. Calling one `ref`
  // also trips `react-hooks/refs`, which reasonably reads any `x.somethingRef`
  // beside a `.current`-shaped access as a ref being read during render.
  return {
    /** Put on a zero-height marker at the very top of the scroll region. */
    attachTop,
    /** Put on the wrapper around the real button at the end of the list. */
    attachAddButton,
    showAddBar: enabled && !atTop && !addButtonOnScreen,
  };
}

/** The marker the top sentinel watches. Renders nothing anybody can see. */
export function StickyAddTop({
  attach,
}: {
  attach: (node: HTMLDivElement | null) => void;
}) {
  return <div ref={attach} aria-hidden className="h-px shrink-0" />;
}

/**
 * The pinned copy.
 *
 * **Always rendered while the list is; it slides rather than appears.**
 * Mounting and unmounting it makes the bar blink into existence mid-scroll and
 * — because it would be a flex sibling — take a strip of height with it each
 * time, shunting the list up and down.
 *
 * Absolute, so it lies over the bottom of the list instead of shrinking it,
 * which is what a floating action bar should do anyway. Nothing underneath is
 * lost, because it hides exactly when the end of the list comes into view.
 *
 * `inert` while hidden, so a bar that is off screen and unreadable is not still
 * in the tab order — an invisible control that can be focused is worse than one
 * that is simply absent.
 *
 * The parent must be `relative`.
 */
export function StickyAddBar({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  return (
    <div
      inert={!visible}
      aria-hidden={!visible}
      className={cx(
        "absolute inset-x-0 bottom-0 z-10 flex items-center border-t border-border bg-surface p-lg",
        "transition-[transform,opacity] duration-[var(--duration-control)] ease-[var(--ease-arrive)]",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      {children}
    </div>
  );
}
