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

/**
 * The scrolling box a row lives in, or null when the page itself scrolls.
 *
 * Found per drag rather than passed in: every screen here pins a header and
 * scrolls a list under it, so the box exists, but which element it is depends
 * on the screen — and a hook that demanded a ref for it would make every list
 * wire one up for something the DOM can simply be asked.
 */
function scrollerOf(node: HTMLElement): HTMLElement | null {
  let element = node.parentElement;
  while (element) {
    const overflow = getComputedStyle(element).overflowY;
    if (
      (overflow === "auto" || overflow === "scroll") &&
      element.scrollHeight > element.clientHeight
    ) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
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

  /**
   * Where each row sat after the last layout, in **container** coordinates.
   *
   * Container rather than viewport, so the numbers survive scrolling. A drag
   * near the bottom of a long menu scrolls the list — deliberately, see the
   * edge-scroll loop below — and viewport coordinates would shift under every
   * row at once while none of them had actually moved.
   */
  const lastTop = useRef(new Map<string, number>());
  /** What we have currently translated each row by. */
  const shifted = useRef(new Map<string, number>());
  /** Pointer position and the row's layout top when the drag began. */
  const grip = useRef<{ pointerY: number; top: number } | null>(null);
  /** The last pointer position, so the edge-scroll loop knows where it is. */
  const pointerY = useRef(0);
  /** The scrolling ancestor the drag happens inside, found once per drag. */
  const scroller = useRef<HTMLElement | null>(null);
  const frames = useRef<number[]>([]);
  /** The order as of the last layout, so a render can be asked what changed. */
  const lastOrder = useRef("");
  /** When the last set of return animations will have finished. */
  const settleBy = useRef(0);

  /**
   * Set in the pointer handlers, never during render.
   *
   * The edge-scroll loop runs outside React and needs to know whether a drag is
   * still in progress; `dragging` state alone would be a stale closure by the
   * time the loop reads it.
   */
  const held = useRef<string | null>(null);
  /**
   * Re-pointed at the current render's logic, so the loop is never stale.
   *
   * The edge-scroll loop and the layout effect both run outside React's data
   * flow and need this render's `order`, `moveTo` and `announce`. Captured in a
   * closure they would be whatever they were when the drag started.
   */
  const followRef = useRef<((clientY: number) => void) | null>(null);
  const orderRef = useRef<string[]>(ids);
  const moveRef = useRef<((id: string, to: number) => string[]) | null>(null);
  const announceRef = useRef<((id: string, next: string[]) => void) | null>(
    null,
  );

  /** How far the container has scrolled, which container coordinates add back. */
  const scrolled = useCallback(
    () => scroller.current?.scrollTop ?? window.scrollY,
    [],
  );

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
      held.current = null;
      scroller.current = null;
      // Otherwise text selects itself all the way down the page as you drag,
      // and the cursor reverts to an arrow the moment it leaves the handle —
      // which it does immediately, because the row moves out from under it.
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
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

  /**
   * Put the held row under the cursor, and work out where it now belongs.
   *
   * Called from `pointermove`, from the edge-scroll loop — where the pointer is
   * still and the list is what moves — and from the layout effect, so a row
   * whose slot has just changed is repositioned before anything is painted.
   */
  const follow = useCallback(
    (clientY: number) => {
      const id = held.current;
      if (!id || !grip.current) return;

      const node = rowNode(id);
      if (!node) return;

      const y = clientY + scrolled();

      // How far the pointer has travelled, less however far the row's own slot
      // has moved since the drag began. Without the second term the row leaps
      // by its own height the moment it swaps past a neighbour: the layout has
      // put it in its new slot while the transform is still measured from the
      // old one.
      const top = lastTop.current.get(id) ?? grip.current.top;
      place(
        node,
        id,
        y - grip.current.pointerY + (grip.current.top - top),
        false,
      );

      const current = orderRef.current;
      const from = current.indexOf(id);

      // The first row whose midpoint the pointer has crossed, in the direction
      // of travel. Stored layout positions, not freshly measured ones: a
      // neighbour part way through its own animation is somewhere neither here
      // nor there, and comparing against that makes the target flicker.
      let to = from;
      for (let i = 0; i < current.length; i += 1) {
        if (current[i] === id) continue;
        const other = rowNode(current[i]);
        const otherTop = lastTop.current.get(current[i]);
        if (!other || otherTop === undefined) continue;
        const middle = otherTop + other.offsetHeight / 2;
        if (i < from && y < middle) {
          to = i;
          break;
        }
        if (i > from && y > middle) to = i;
      }

      if (to !== from) {
        const next = moveRef.current?.(id, to);
        if (next) announceRef.current?.(id, next);
      }
    },
    [place, scrolled],
  );

  /**
   * Scrolls the list when the drag reaches its edge.
   *
   * Without it, reordering is bounded by whatever happens to be on screen:
   * moving an item to the top of a menu that does not fit means dropping it,
   * scrolling by hand, picking it up again, and repeating. The list coming to
   * meet the drag is the difference between a gesture and a chore.
   *
   * ## Why an effect rather than a loop the handlers start and stop
   *
   * It lives exactly as long as a drag, and React is what starts and ends it —
   * so there is no way to leave a frame loop running after a pointer is lost, a
   * row unmounts, or the operator navigates away mid-drag. The first version
   * started it in `pointerdown` and cancelled it in three separate places, and
   * a loop that has to be cancelled in three places is one that will one day be
   * cancelled in two.
   *
   * It runs on its own frames rather than on `pointermove`, because the pointer
   * stops moving once it reaches the edge — which is precisely when the
   * scrolling needs to keep going.
   */
  useEffect(() => {
    if (dragging === null) return;

    let frame = requestAnimationFrame(function tick() {
      const box = scroller.current;
      if (box) {
        const bounds = box.getBoundingClientRect();
        const edge = 64;
        const fromTop = pointerY.current - bounds.top;
        const fromBottom = bounds.bottom - pointerY.current;

        // Proportional to how far into the edge the pointer is, so it creeps at
        // the boundary and moves properly at the very end. A fixed speed is
        // either too slow to be useful or too fast to aim with.
        let by = 0;
        if (fromTop < edge) by = -Math.ceil((edge - fromTop) / 4);
        else if (fromBottom < edge) by = Math.ceil((edge - fromBottom) / 4);

        if (by !== 0) {
          const before = box.scrollTop;
          box.scrollTop += by;
          // Only when it actually moved. At either end of the list this does
          // nothing, and re-placing the row for a scroll that did not happen
          // would fight the pointer.
          if (box.scrollTop !== before) followRef.current?.(pointerY.current);
        }
      }

      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [dragging]);

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
      if (!node) return;

      scroller.current = scrollerOf(node);
      pointerY.current = event.clientY;
      held.current = id;
      grip.current = {
        pointerY: event.clientY + scrolled(),
        top: node.getBoundingClientRect().top + scrolled(),
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";

      setDragging(id);
      setDraft(ids);
    },
    [disabled, grabbed, ids, scrolled, setDraft],
  );

  const onPointerMove = useCallback(
    (id: string) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (held.current !== id) return;
      pointerY.current = event.clientY;
      follow(event.clientY);
    },
    [follow],
  );

  const onPointerUp = useCallback(
    (id: string) => () => {
      if (held.current !== id) return;
      release(id);
      commit(draft ?? ids);
    },
    [commit, draft, ids, release],
  );

  /**
   * Measure, invert, play — **when the order changed, and only then.**
   *
   * It runs after every render, which is what makes a keyboard move and a
   * pointer move animate identically: neither has to tell this that anything
   * happened. But a render is not the same thing as a reorder, and conflating
   * them was a bug people saw as a flicker on screens that have nothing to do
   * with dragging.
   *
   * A row's position changes for all sorts of reasons that are not a move. The
   * side panel opens and the list beside it narrows, so every description
   * rewraps and every row below shifts. A toggle flips. A query settles. The
   * first version animated all of it — open a form and the whole list slid
   * about for a fifth of a second, which reads as the page glitching.
   *
   * So the order is compared first. When it is unchanged the effect only brings
   * its record of where things are up to date, and nothing moves. **Animation
   * is for the thing the operator did, never for the layout reacting to
   * something else** — which is the same rule `reveal()` follows about
   * scrolling.
   *
   * ## Transforms are cleared before measuring, and that is the whole trick
   *
   * The first version subtracted the transform it *intended* each row to have.
   * `getBoundingClientRect` reports the **interpolated** one — so for the
   * couple of hundred milliseconds a row is animating home, the measurement was
   * wrong by however far it had left to travel. Reorder again inside that
   * window, which is exactly what happens when somebody drags at a normal
   * speed, and the bad number is stored as that row's layout position and
   * every calculation after it inherits the error. The symptom is a row
   * stranded a long way from its slot with a gap where it belongs.
   *
   * So every transform is cleared first, then everything is measured, then the
   * inversions go on. Three passes rather than one, because interleaving them
   * would have each measurement invalidated by the previous write.
   */
  useIsomorphicLayoutEffect(() => {
    // Re-point the out-of-React handles at this render's logic. In the effect
    // rather than in the body, because writing a ref during render is what
    // makes a component's output depend on when it happened to be called.
    followRef.current = follow;
    moveRef.current = moveTo;
    announceRef.current = announce;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const nodes: [string, HTMLElement][] = [];
    for (const id of order) {
      const node = rowNode(id);
      if (node) nodes.push([id, node]);
    }

    const signature = order.join(",");
    const reordered = signature !== lastOrder.current;
    lastOrder.current = signature;

    if (!reordered) {
      // Nothing moved on purpose. Positions may still have changed — the panel
      // opening is the common one — and the record has to follow them, or the
      // next real move would animate from where rows used to be.
      //
      // Only while everything is still, though. Measuring a row that is part
      // way through its own animation stores the position it is passing
      // through, which is the same poisoned-baseline bug that stranded a
      // dragged row; and a held row is deliberately not where its layout says.
      // Skipping is safe where guessing is not: the next reorder measures
      // afresh anyway, and the worst case is one animation that starts from
      // slightly the wrong place.
      if (held.current === null && performance.now() > settleBy.current) {
        const idle = scrolled();
        for (const [id, node] of nodes) {
          lastTop.current.set(id, node.getBoundingClientRect().top + idle);
        }
      }
      return;
    }

    // 1. Neutralise, so what is measured is layout rather than paint.
    for (const [, node] of nodes) {
      node.style.transition = "none";
      node.style.transform = "";
    }

    // 2. Measure. One forced reflow for the whole list, not one per row.
    const offset = scrolled();
    const tops = new Map(
      nodes.map(([id, node]) => [
        id,
        node.getBoundingClientRect().top + offset,
      ]),
    );

    orderRef.current = order;

    // 3. Invert, and play.
    for (const [id, node] of nodes) {
      const top = tops.get(id) as number;
      const before = lastTop.current.get(id);
      lastTop.current.set(id, top);
      shifted.current.set(id, 0);

      // The dragged row answers to the pointer, not to this. Its baseline has
      // just moved though, so it is put back under the cursor immediately —
      // within this same frame, so nothing is ever painted at zero.
      if (id === held.current) {
        followRef.current?.(pointerY.current);
        continue;
      }

      if (before === undefined || before === top || reduced) continue;

      // Comfortably past `--duration-control` plus the two frames below. It
      // gates a re-measurement, not the animation itself, so an approximation
      // costs at most a skipped update rather than a wrong one.
      settleBy.current = performance.now() + 500;

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
