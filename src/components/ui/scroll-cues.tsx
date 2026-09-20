"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { t } from "@/i18n/translations";

/**
 * "There is more below" — said in words, on every pane that has more below.
 *
 * ## Why this is not a shadow
 *
 * It was one: a gradient at the bottom edge, drawn in CSS with no JavaScript,
 * which is the conventional answer and the one most design systems ship. It is
 * also a *hint* rather than a message — it tells somebody who already knows
 * the convention that the box is scrollable, and tells everybody else nothing.
 * The operators using this are not reading a design system; they are checking
 * whether that was the last order. So the cue says so, and can be pressed.
 *
 * ## Why one component for the whole dashboard
 *
 * There are thirty-odd scrolling panes across twenty-seven files. A cue added
 * per pane is a cue the twenty-eighth pane forgets — the same argument `ROW`
 * makes about its hover state. Every pane already carries `.scroll-hint`, so
 * this finds them rather than being handed them, and a new screen gets the
 * behaviour by using the class the rest of the dashboard already uses.
 *
 * ## Why it is `fixed` and portalled rather than drawn inside the pane
 *
 * A cue *inside* a scroller has to be a sticky child, and a sticky child takes
 * part in layout: it adds its own height to the content, which is what the
 * scroller measures to decide whether there is more to scroll. Hiding it at
 * the bottom then shortens the content, which can make the pane scrollable
 * again, which shows the cue, which lengthens it. A real oscillation, and an
 * unpleasant one to debug.
 *
 * Positioned over the pane instead, it costs the layout nothing and cannot
 * feed back into the measurement it depends on.
 *
 * ## What it costs to keep current
 *
 * One `scroll` listener, in the **capture** phase on the document — scroll
 * events do not bubble, but they do capture, so one listener sees every pane.
 * A `ResizeObserver` for panes that change size, and a `MutationObserver` for
 * panes that come and go with a route. Everything funnels into one
 * `requestAnimationFrame`, so a fast scroll measures once per frame rather
 * than once per event.
 */

/** How far from the bottom still counts as "there is more". */
const SLACK = 24;

/** How much of a pane one press moves — most of it, with an overlap to read. */
const PAGE = 0.8;

/**
 * How far a pane must be scrolled before it offers to go back to the top.
 *
 * More than half a screenful, and deliberately not `SLACK`. The down cue
 * answers "is that everything", which is worth saying the moment anything is
 * hidden. Going back to the top is only worth offering once the top is far
 * enough away to be a nuisance to reach — at forty pixels down, a cue telling
 * you how to travel forty pixels is noise.
 */
const FAR = 0.6;

type Cue = {
  /** Identity across frames, so React keeps the same node and it can animate. */
  key: string;
  pane: HTMLElement;
  /** Which edge, which decides the words, the arrow and where it goes. */
  dir: "up" | "down";
  /** Where to draw, in viewport coordinates. */
  left: number;
  top: number;
};

export function ScrollCues() {
  const [cues, setCues] = useState<Cue[]>([]);
  /**
   * Stable ids per pane element.
   *
   * A `WeakMap`, so a pane that is unmounted takes its entry with it rather
   * than leaving this growing for the life of the session.
   */
  const ids = useRef(new WeakMap<HTMLElement, number>());
  const nextId = useRef(1);
  const frame = useRef(0);

  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const found: Cue[] = [];

      for (const node of document.querySelectorAll<HTMLElement>(
        ".scroll-hint",
      )) {
        const more =
          node.scrollHeight - node.clientHeight - node.scrollTop > SLACK;
        const far = node.scrollTop > node.clientHeight * FAR;
        if (!more && !far) continue;

        const box = node.getBoundingClientRect();
        // A pane scrolled out of view, or collapsed to nothing by a hidden
        // tab, still answers `scrollHeight` — but drawing over it would put a
        // pill in the middle of whatever is actually on screen.
        if (box.width === 0 || box.height === 0) continue;

        let id = ids.current.get(node);
        if (id === undefined) {
          id = nextId.current++;
          ids.current.set(node, id);
        }

        const middle = box.left + box.width / 2;

        // Both can be true at once — the middle of a long list is exactly
        // where somebody wants to know they can go either way.
        if (far) {
          found.push({
            key: `${id}-up`,
            pane: node,
            dir: "up",
            left: middle,
            top: box.top,
          });
        }
        if (more) {
          found.push({
            key: `${id}-down`,
            pane: node,
            dir: "down",
            left: middle,
            top: box.bottom,
          });
        }
      }

      setCues((current) => (same(current, found) ? current : found));
    });
  }, []);

  useEffect(() => {
    measure();

    // Capture, because `scroll` does not bubble — one listener for every pane.
    document.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    const resize = new ResizeObserver(measure);
    const mutate = new MutationObserver(measure);

    for (const node of document.querySelectorAll(".scroll-hint")) {
      resize.observe(node);
    }
    mutate.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame.current);
      document.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      resize.disconnect();
      mutate.disconnect();
    };
  }, [measure]);

  // Re-observe whatever is on screen now. Panes arrive with a route change and
  // a `ResizeObserver` only watches what it was given.
  useEffect(() => {
    const resize = new ResizeObserver(measure);
    for (const cue of cues) resize.observe(cue.pane);
    return () => resize.disconnect();
  }, [cues, measure]);

  if (cues.length === 0) return null;

  return createPortal(
    <>
      {cues.map((cue) => (
        <button
          key={cue.key}
          type="button"
          onClick={() =>
            cue.dir === "down"
              ? cue.pane.scrollBy({
                  top: cue.pane.clientHeight * PAGE,
                  behavior: "smooth",
                })
              : // All the way, not one page back. Pressing "back to top" twice
                // to reach the top would be a control that does not do what it
                // says, and the way down is the scroll wheel either way.
                cue.pane.scrollTo({ top: 0, behavior: "smooth" })
          }
          style={{ left: cue.left, top: cue.top }}
          className={cue.dir === "down" ? "scroll-cue" : "scroll-cue is-up"}
        >
          {cue.dir === "down" ? t("common.scrollMore") : t("common.scrollTop")}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {cue.dir === "down" ? (
              <path d="M12 5v14M5 12l7 7 7-7" />
            ) : (
              <path d="M12 19V5M5 12l7-7 7 7" />
            )}
          </svg>
        </button>
      ))}
    </>,
    document.body,
  );
}

/** Whether two measurements are the same, so an unchanged frame re-renders nothing. */
function same(a: Cue[], b: Cue[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((cue, index) => {
    const other = b[index];
    return (
      cue.key === other.key &&
      Math.round(cue.left) === Math.round(other.left) &&
      Math.round(cue.top) === Math.round(other.top)
    );
  });
}
