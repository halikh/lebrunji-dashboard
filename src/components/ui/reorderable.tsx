"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { t } from "@/i18n/translations";

import { cx } from "./index";

/**
 * Putting a list in the order the merchant wants it in.
 *
 * Menu sections, the items inside them, categories and the delivery ladder are
 * all ordered by a `sort_order` a person decides. Dragging is the obvious
 * gesture and it is not sufficient on its own: a pointer drag is unusable
 * without a pointer, and "reorder the menu" is not an optional part of the
 * product that keyboard users can be asked to do somewhere else.
 *
 * So the handle is a **button**, and it does both.
 *
 * - **Pointer** — press and move. The row follows the cursor, and the rows it
 *   passes slide out of its way.
 * - **Keyboard** — focus the handle, press Enter or Space to pick the row up,
 *   arrow up and down to move it, Enter or Space to drop, Escape to put it
 *   back. Every move is announced, and the rows animate the same way.
 *
 * Both drive the same preview list and commit through the same call, so there
 * is one ordering mechanism rather than a real one and an accessible imitation
 * of it that drifts from it.
 *
 * ## The movement is FLIP, and it has to be
 *
 * The first version reordered the array and let React re-render. That is
 * correct and it looks broken: rows teleport, and the one being dragged sits
 * still under a moving cursor, so there is nothing connecting the gesture to
 * the result. A CSS transition does not fix it either — the rows are not being
 * transformed, they are being re-laid-out, and layout does not transition.
 *
 * So each render measures where every row *was* and where it now *is*, puts it
 * back with a transform, and releases it on the next frame — the standard FLIP
 * inversion. Measuring rather than assuming is what makes it work with rows of
 * different heights, which these are: a section block is much taller than the
 * item rows inside it.
 *
 * The dragged row is excluded from that and simply tracks the pointer, with its
 * baseline corrected each time the layout shifts underneath it. Otherwise it
 * would leap by its own height the moment it swapped past a neighbour.
 *
 * ## Why it commits an order of ids rather than an index
 *
 * "Moved from 3 to 1" needs the caller to know what the list was, and after an
 * optimistic update or a realtime change it may not. A whole array of ids is
 * the state the caller writes anyway — one `sort_order` per row — and it is
 * idempotent: applying it twice produces the same menu, which matters because
 * a reorder is several writes and any of them can be retried.
 *
 * ## Why the preview is local state and not the query cache
 *
 * A drag is not a fact about the world until it is dropped. Writing every
 * intermediate position into the cache would make an abandoned drag — an
 * Escape, a dropped pointer, a page the operator navigates away from — leave
 * the list looking rearranged when nothing was saved.
 */

/** Layout effects do not run on the server, and React says so out loud. */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The row's element, found by the mark `rowProps` puts on it.
 *
 * Searched from the document rather than from a container the hook would have
 * to be handed: ids here are database uuids, so one is unambiguous anywhere on
 * the page, and requiring a container ref would make every list pass one in for
 * the sake of a lookup that happens outside render anyway.
 */
function rowNode(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-reorder-id="${CSS.escape(id)}"]`,
  );
}

type Options = {
  /** The current order, as the server has it. */
  ids: string[];
  /** The new order, once a move is committed. Called only when it changed. */
  onReorder: (ids: string[]) => void;
  /** What to call a row when announcing a move. */
  labelOf: (id: string) => string;
  disabled?: boolean;
};

export function useReorder({
  ids,
  onReorder,
  labelOf,
  disabled = false,
}: Options) {
  /**
   * The order being previewed mid-move, stamped with the server order it was
   * built from.
   *
   * The stamp is what makes this **derived** rather than something an effect
   * has to clean up. When a refetch changes the real order — an import, another
   * tab, this list's own write landing — the stamp no longer matches and the
   * preview is simply not used. An effect that reset it would run a render
   * later, which is one frame of a list showing an order nobody saved.
   */
  const [preview, setPreview] = useState<{
    signature: string;
    order: string[];
  } | null>(null);
  /** Picked up by keyboard — it stays picked up between key presses. */
  const [grabbed, setGrabbed] = useState<string | null>(null);
  /** Held by a pointer, which releases on pointerup. */
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const instructionsId = useId();

  const signature = ids.join(",");
  const draft = preview?.signature === signature ? preview.order : null;

  const order = draft ?? ids;
  const moving = grabbed ?? dragging;

  const setDraft = useCallback(
    (next: string[] | null) => {
      setPreview(next === null ? null : { signature, order: next });
    },
    [signature],
  );

  // ---- the animation's bookkeeping ---------------------------------------
  //
  // Refs rather than state: none of it is rendered, and writing it during a
  // pointer move sixty times a second must not cost a render.

  /** Where each row's box sat after the last layout, ignoring our transform. */
  const lastTop = useRef(new Map<string, number>());
  /** What we have currently translated each row by. */
  const shifted = useRef(new Map<string, number>());
  /** The pointer position and the row's layout top when the drag began. */
  const grip = useRef<{ pointerY: number; top: number } | null>(null);
  const frames = useRef<number[]>([]);

  /** A row's layout position — its box, with our own transform taken back out. */
  const layoutTopOf = useCallback((id: string, node: HTMLElement): number => {
    return node.getBoundingClientRect().top - (shifted.current.get(id) ?? 0);
  }, []);

  const place = useCallback(
    (node: HTMLElement, id: string, by: number, animate: boolean) => {
      node.style.transition = animate
        ? "transform var(--duration-control) var(--ease-arrive)"
        : "none";
      node.style.transform = by === 0 ? "" : `translateY(${by}px)`;
      shifted.current.set(id, by);
    },
    [],
  );

  // Measure, invert, play. Runs after every render, which is what makes a
  // keyboard move and a pointer move animate identically — neither one has to
  // tell this that anything happened.
  useIsomorphicLayoutEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    for (const id of order) {
      const node = rowNode(id);
      if (!node) continue;

      const top = layoutTopOf(id, node);
      const before = lastTop.current.get(id);
      lastTop.current.set(id, top);

      // The dragged row is following the pointer; its transform is not this
      // effect's to set. Its baseline moved though, and `onPointerMove` reads
      // `lastTop` to correct for exactly that.
      //
      // `dragging` is read straight from the closure: the effect has no
      // dependency array, so it re-runs after every render with the current
      // value — a ref mirroring it would be one more thing to keep in step,
      // and writing one during render is what React's lint rule forbids.
      if (id === dragging) continue;

      if (before === undefined || before === top || reduced) continue;

      // Put it back where it was, then let it go. Two frames, because a
      // transform set and cleared within one is not a transition.
      place(node, id, before - top, false);
      frames.current.push(
        requestAnimationFrame(() => {
          frames.current.push(
            requestAnimationFrame(() => place(node, id, 0, true)),
          );
        }),
      );
    }
  });

  useEffect(() => {
    const pending = frames.current;
    return () => {
      for (const frame of pending) cancelAnimationFrame(frame);
    };
  }, []);

  const announce = useCallback(
    (id: string, next: string[]) => {
      setAnnouncement(
        t("reorder.movedTo", {
          name: labelOf(id),
          position: next.indexOf(id) + 1,
          count: next.length,
        }),
      );
    },
    [labelOf],
  );

  /** Moves `id` to `to`, previewing the result. Returns the new order. */
  const moveTo = useCallback(
    (id: string, to: number): string[] => {
      const current = draft ?? ids;
      const from = current.indexOf(id);
      const clamped = Math.max(0, Math.min(to, current.length - 1));
      if (from === -1 || from === clamped) return current;

      const next = [...current];
      next.splice(from, 1);
      next.splice(clamped, 0, id);
      setDraft(next);
      return next;
    },
    [draft, ids, setDraft],
  );

  /** Lets go: the row settles into its new place rather than snapping to it. */
  const release = useCallback(
    (id: string) => {
      const node = rowNode(id);
      if (node) place(node, id, 0, true);
      grip.current = null;
    },
    [place],
  );

  const commit = useCallback(
    (next: string[]) => {
      setDraft(null);
      setGrabbed(null);
      setDragging(null);
      // Unchanged is not a write. A drag that ends where it started, or a
      // pick-up-and-drop with no arrow keys between, should cost nothing.
      if (next.join(",") !== ids.join(",")) onReorder(next);
    },
    [ids, onReorder, setDraft],
  );

  const cancel = useCallback(() => {
    setDraft(null);
    setGrabbed(null);
    setDragging(null);
    setAnnouncement(t("reorder.cancelled"));
  }, [setDraft]);

  // ---- pointer -----------------------------------------------------------

  const onPointerDown = useCallback(
    (id: string) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      // Primary button only, and never while a keyboard move is in progress —
      // two mechanisms driving one preview is how a row ends up in a position
      // neither gesture asked for.
      if (disabled || event.button !== 0 || grabbed !== null) return;
      event.preventDefault();
      // Capture, so the drag survives the pointer leaving the handle — which it
      // does immediately, because the row moves out from under it.
      event.currentTarget.setPointerCapture(event.pointerId);

      const node = rowNode(id);
      grip.current = node
        ? { pointerY: event.clientY, top: layoutTopOf(id, node) }
        : null;

      setDragging(id);
      setDraft(ids);
    },
    [disabled, grabbed, ids, layoutTopOf, setDraft],
  );

  const onPointerMove = useCallback(
    (id: string) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (dragging !== id || !grip.current) return;

      const node = rowNode(id);
      if (!node) return;

      // How far the pointer has travelled, less however far the row's own
      // layout position has moved since the drag began. Without the second
      // term the row leaps by its own height the moment it swaps past a
      // neighbour — the layout puts it in its new slot while the transform is
      // still measured from the old one.
      const top = lastTop.current.get(id) ?? grip.current.top;
      const by =
        event.clientY - grip.current.pointerY + (grip.current.top - top);
      place(node, id, by, false);

      const current = draft ?? ids;
      const from = current.indexOf(id);
      const y = event.clientY;

      // The first row whose midpoint the pointer has crossed, in the direction
      // of travel. Layout positions, not painted ones: comparing against a
      // neighbour that is itself mid-animation makes the target flicker.
      let to = from;
      for (let i = 0; i < current.length; i += 1) {
        if (current[i] === id) continue;
        const other = rowNode(current[i]);
        if (!other) continue;
        const middle =
          (lastTop.current.get(current[i]) ??
            other.getBoundingClientRect().top) +
          other.offsetHeight / 2;
        if (i < from && y < middle) {
          to = i;
          break;
        }
        if (i > from && y > middle) to = i;
      }

      if (to !== from) announce(id, moveTo(id, to));
    },
    [announce, dragging, draft, ids, moveTo, place],
  );

  const onPointerUp = useCallback(
    (id: string) => () => {
      if (dragging !== id) return;
      release(id);
      commit(draft ?? ids);
    },
    [commit, dragging, draft, ids, release],
  );

  // ---- keyboard ----------------------------------------------------------

  const onKeyDown = useCallback(
    (id: string) => (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const current = draft ?? ids;
      const index = current.indexOf(id);

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (grabbed === id) {
          commit(current);
          setAnnouncement(t("reorder.dropped", { name: labelOf(id) }));
        } else {
          setGrabbed(id);
          setDraft(current);
          setAnnouncement(
            t("reorder.grabbed", {
              name: labelOf(id),
              position: index + 1,
              count: current.length,
            }),
          );
        }
        return;
      }

      if (event.key === "Escape" && grabbed === id) {
        event.preventDefault();
        cancel();
        return;
      }

      if (grabbed !== id) return;

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        // Otherwise the page scrolls out from under the row being moved.
        event.preventDefault();
        announce(id, moveTo(id, index + (event.key === "ArrowUp" ? -1 : 1)));
      }
    },
    [
      announce,
      cancel,
      commit,
      disabled,
      draft,
      grabbed,
      ids,
      labelOf,
      moveTo,
      setDraft,
    ],
  );

  // ---- what the caller spreads -------------------------------------------

  /**
   * Spread onto the row itself.
   *
   * It takes the caller's own classes rather than returning its own for them to
   * merge, because a spread `className` silently replaces the element's — and
   * the row would lose its border and padding the moment it was made
   * orderable, which looks like a styling mistake rather than a missing merge.
   */
  const rowProps = useCallback(
    (id: string, className?: string) => ({
      // The row marks itself, rather than handing back a ref callback.
      //
      // A ref would be the obvious way to find these, and it is the wrong one
      // here: the only code that needs a row's position is the pointer-move
      // handler and the FLIP effect, both of which run outside render and can
      // simply ask the DOM. Collecting every node into a map during render buys
      // nothing, has to be kept in step as rows mount and unmount, and means
      // reading a ref while rendering — which React's own lint rule flags.
      "data-reorder-id": id,
      className: cx(
        className,
        // Lifted while it is the one being moved, so the eye can follow it over
        // the rows it is passing. `relative` gives the z-index something to
        // act on.
        moving === id && "relative z-10 shadow-raised",
      ),
    }),
    [moving],
  );

  const handleProps = useCallback(
    (id: string) => ({
      type: "button" as const,
      disabled,
      "aria-label": t("reorder.handle", { name: labelOf(id) }),
      "aria-describedby": instructionsId,
      // Not `aria-grabbed`, which is deprecated and unimplemented. Pressed
      // states what is true — this button is currently holding its row — and
      // the live region carries the rest.
      "aria-pressed": grabbed === id,
      onPointerDown: onPointerDown(id),
      onPointerMove: onPointerMove(id),
      onPointerUp: onPointerUp(id),
      onPointerCancel: onPointerUp(id),
      onKeyDown: onKeyDown(id),
      // `touch-none` so a drag on a phone moves the row rather than scrolling
      // the page out from under it.
      className: cx(
        "flex size-[28px] shrink-0 touch-none items-center justify-center rounded-sm text-text-faint",
        "hover:bg-neutral-fill hover:text-text-soft",
        moving === id ? "cursor-grabbing" : "cursor-grab",
      ),
    }),
    [
      disabled,
      grabbed,
      instructionsId,
      labelOf,
      moving,
      onKeyDown,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    ],
  );

  /**
   * The rows in preview order.
   *
   * Sorting here rather than making the caller do it keeps the preview and the
   * DOM in step — a caller that rendered its own order would show the committed
   * list while the hook believed it was showing the draft.
   */
  const ordered = useCallback(
    <T,>(rows: T[], idOf: (row: T) => string): T[] => {
      const position = new Map(order.map((id, index) => [id, index]));
      return [...rows].sort(
        (a, b) => (position.get(idOf(a)) ?? 0) - (position.get(idOf(b)) ?? 0),
      );
    },
    [order],
  );

  return {
    ordered,
    rowProps,
    handleProps,
    isMoving: moving !== null,
    /**
     * Render once per list. Carries the instructions the handles point at, and
     * the live region that reports every move.
     */
    instructions: (
      <>
        <p id={instructionsId} className="sr-only">
          {t("reorder.instructions")}
        </p>
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </>
    ),
  };
}

/**
 * The grip. Six dots, which is what this means everywhere.
 *
 * Drawn rather than written because it is repeated on every row of every
 * orderable list, and a word there would compete with the row's own name.
 */
export function GripIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="5" cy="3" r="1.4" />
      <circle cx="9" cy="3" r="1.4" />
      <circle cx="5" cy="7" r="1.4" />
      <circle cx="9" cy="7" r="1.4" />
      <circle cx="5" cy="11" r="1.4" />
      <circle cx="9" cy="11" r="1.4" />
    </svg>
  );
}
