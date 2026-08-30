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
 * Every scrolling box the row sits inside, nearest first.
 *
 * ## Why a chain and not just the nearest
 *
 * The first version took the nearest scrollable ancestor and scrolled that. It
 * is right almost always and wrong in the case that matters: **once that box is
 * at its limit, there is nothing more it can do**, and the drag simply stops
 * against the edge with the pointer pushing at it. Which is indistinguishable
 * from the drag having frozen — it was reported as lag, and it is the last
 * thing anybody would look at, because the row is still following the cursor
 * perfectly right up until the moment it cannot go any further.
 *
 * So the loop walks the chain and scrolls the first box that can still move in
 * the direction it is asking for. A menu inside a scrolling pane inside a page
 * hands the drag off outward as each one runs out.
 *
 * `documentElement` is on the end because a page that scrolls is still a
 * scrolling box, and whether it is in the chain is a layout decision this hook
 * should not have an opinion about.
 */
function scrollersOf(node: HTMLElement): HTMLElement[] {
  const found: HTMLElement[] = [];
  let element = node.parentElement;

  while (element) {
    const overflow = getComputedStyle(element).overflowY;
    if (
      (overflow === "auto" || overflow === "scroll") &&
      element.scrollHeight > element.clientHeight
    ) {
      found.push(element);
    }
    element = element.parentElement;
  }

  const page = document.scrollingElement as HTMLElement | null;
  if (page && page.scrollHeight > page.clientHeight && !found.includes(page)) {
    found.push(page);
  }

  return found;
}

type Options = {
  /** The current order, as the server has it. */
  ids: string[];
  /** The new order, once a move is committed. Called only when it changed. */
  onReorder: (ids: string[]) => void;
  /** What to call a row when announcing a move. */
  labelOf: (id: string) => string;
  /**
   * How a row should look while it is being carried.
   *
   * The default suits a row that already has a surface of its own — a menu
   * item, which is a white card. A menu **section** has none: it is a heading
   * and some cards with gaps between them, so lifting it put a shadow around
   * nothing and its header simply overlapped whatever it passed. It reads as
   * content bleeding over content rather than as a block being carried.
   *
   * So the lifted look belongs to the list, not to the hook. It must not change
   * the row's size — padding or a border applied only while dragging would move
   * every measurement this makes — so it is a background, a radius and a
   * shadow, and nothing that takes up space.
   */
  lifted?: string;
  disabled?: boolean;
};

export function useReorder({
  ids,
  onReorder,
  labelOf,
  lifted = "relative z-10 shadow-raised",
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
  /**
   * Each row's element and height, as of the last layout.
   *
   * ## Why the drag reads these instead of the DOM
   *
   * `follow` ran on every pointer event and, for each row, called
   * `querySelector` and then read `offsetHeight` — immediately after writing a
   * transform to the dragged row. Writing a style and then reading a geometric
   * property forces the browser to lay the page out again, synchronously, right
   * then. Once per row, on every one of a hundred-odd pointer events a second,
   * on a page holding a whole menu. That is the lag.
   *
   * None of it needed to be read: rows do not change height while one of them
   * is being carried, and the layout effect has already measured everything in
   * a single pass. So the pointer path now writes one transform and reads
   * nothing at all.
   */
  const nodes = useRef(new Map<string, HTMLElement>());
  const heights = useRef(new Map<string, number>());
  /** Set by `pointermove`, consumed by the frame loop. */
  const dirty = useRef(false);
  /**
   * Measure everything again on the next layout, even mid-drag.
   *
   * Normally a drag must **not** re-measure: a row part way through an
   * animation is somewhere it is only passing through, and storing that poisons
   * every calculation after it. The exception is the first layout after the
   * drag begins, because a list is allowed to change shape at that moment — a
   * section collapses to its header while it is carried — and nothing has been
   * transformed yet, so measuring is exact.
   */
  const remeasure = useRef(false);
  /** Pointer position and the row's layout top when the drag began. */
  const grip = useRef<{ pointerY: number; top: number } | null>(null);
  /** The last pointer position, so the edge-scroll loop knows where it is. */
  const pointerY = useRef(0);
  /**
   * Whether the pointer has actually travelled since it went down.
   *
   * A section's handle sits in its header, which is very often already within
   * the edge zone — so without this, grabbing a section near the top or bottom
   * of the list began scrolling immediately, before the operator had moved at
   * all. The list ran away from under them and it read as the drag being out of
   * control, which it was.
   */
  const travelled = useRef(false);
  /**
   * The scrolling boxes this drag is inside, with where each one sits on
   * screen — taken once, when the drag begins.
   *
   * The bounds are cached because the loop needs them every frame, and reading
   * them fresh is a layout read on a document that had a transform written to
   * it the frame before: a full re-layout, sixty times a second, whether or not
   * the pointer had moved. A box does not move while its content scrolls
   * inside it.
   */
  const scrollers = useRef<
    { element: HTMLElement; top: number; bottom: number }[]
  >([]);
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
  const positionRef = useRef<((clientY: number) => unknown) | null>(null);
  const retargetRef = useRef<((clientY: number) => void) | null>(null);
  const orderRef = useRef<string[]>(ids);
  const moveRef = useRef<((id: string, to: number) => string[]) | null>(null);
  const announceRef = useRef<((id: string, next: string[]) => void) | null>(
    null,
  );

  /** How far the container has scrolled, which container coordinates add back. */
  /**
   * How far the innermost box has scrolled, which container coordinates add
   * back. Only the innermost: it is the one the rows are laid out in, and an
   * outer box scrolling moves the whole list together, rows and all.
   */
  const scrolled = useCallback(
    () => scrollers.current[0]?.element.scrollTop ?? window.scrollY,
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
      if (node) {
        place(node, id, 0, true);
        node.style.willChange = "";
      }
      grip.current = null;
      held.current = null;
      scrollers.current = [];
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
  /**
   * Put the held row under the cursor. Writes one transform, decides nothing.
   *
   * Separate from `retarget` because of what happens when they are one thing.
   * The layout effect has to reposition the row the instant its slot moves —
   * within the same frame, or the row is painted back at zero for a moment. If
   * that call also re-evaluated which slot the row belongs in, it could decide
   * to move it again, which is a `setState` **inside a layout effect**: React
   * flushes it synchronously, the effect runs again, and it can decide again.
   * A single crossing became a burst of full-tree renders before one paint,
   * and what that looks like is the drag stopping dead and then catching up.
   *
   * So the effect only positions. Deciding happens once a frame, in the loop.
   */
  const position = useCallback(
    (clientY: number) => {
      const id = held.current;
      if (!id || !grip.current) return null;

      const node = nodes.current.get(id);
      if (!node) return null;

      const y = clientY + scrolled();

      // How far the pointer has travelled, less however far the row's own slot
      // has moved since the drag began. Without the second term the row leaps
      // by its own height the moment it swaps past a neighbour: the layout has
      // put it in its new slot while the transform is still measured from the
      // old one.
      const slot = lastTop.current.get(id) ?? grip.current.top;
      const height = heights.current.get(id) ?? 0;
      let by = y - grip.current.pointerY + (grip.current.top - slot);

      const current = orderRef.current;

      // Clamped to the list it belongs to.
      //
      // Nothing stopped a row travelling past the ends. With the edge-scroll
      // pushing the pointer's position ever further down and only two or three
      // sections to pass, a dragged section ran out of neighbours and simply
      // kept going — off into empty space below the list. A row cannot be
      // dropped outside the list, so it should not be draggable outside it.
      const first = lastTop.current.get(current[0]);
      const lastId = current[current.length - 1];
      const lastSlot = lastTop.current.get(lastId);
      const lastHeight = heights.current.get(lastId);
      if (first !== undefined && lastSlot !== undefined && lastHeight) {
        const bottom = lastSlot + lastHeight;
        by = Math.max(first - slot, Math.min(by, bottom - height - slot));
      }

      place(node, id, by, false);

      return { id, current, top: slot + by, bottom: slot + by + height };
    },
    [place, scrolled],
  );

  /**
   * Where the carried row now belongs, and moving it there.
   *
   * ## The row's own edges decide, not the pointer
   *
   * Comparing the *pointer* against a neighbour's midpoint works while every
   * row is the same height, and fails badly once they are not. A menu section
   * is a header plus all its items — several hundred pixels — so its
   * neighbour's midpoint is a long way off, and the pointer had to travel most
   * of a section's height before anything swapped, by which time the dragged
   * block had visibly ploughed through the one below it.
   *
   * Where the dragged row *is* answers the question the operator is actually
   * asking: its leading edge passing a neighbour's midpoint is the moment it
   * has taken that place. It is also independent of where within the row the
   * handle happens to sit.
   *
   * At most one move per call, and this is called once a frame — so a row
   * crossing several places travels through them over several frames rather
   * than in one synchronous burst. That is both smoother to watch and a
   * fraction of the work.
   */
  const retarget = useCallback(
    (clientY: number) => {
      const placed = position(clientY);
      if (!placed) return;

      const { id, current, top, bottom } = placed;
      const from = current.indexOf(id);

      // Stored layout positions, not freshly measured ones: a neighbour part
      // way through its own animation is somewhere neither here nor there, and
      // comparing against that makes the target flicker.
      let to = from;
      for (let i = 0; i < current.length; i += 1) {
        if (current[i] === id) continue;
        const otherTop = lastTop.current.get(current[i]);
        const otherHeight = heights.current.get(current[i]);
        if (otherTop === undefined || otherHeight === undefined) continue;
        const middle = otherTop + otherHeight / 2;
        if (i < from && top < middle) {
          to = i;
          break;
        }
        if (i > from && bottom > middle) to = i;
      }

      if (to !== from) {
        const next = moveRef.current?.(id, to);
        if (next) announceRef.current?.(id, next);
      }
    },
    [position],
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
      let moved = false;

      if (travelled.current) {
        const edge = 64;

        for (const { element, top, bottom } of scrollers.current) {
          const fromTop = pointerY.current - top;
          const fromBottom = bottom - pointerY.current;

          // Proportional to how far into the edge the pointer is, so it creeps
          // at the boundary and moves properly at the very end. A fixed speed
          // is either too slow to be useful or too fast to aim with.
          let by = 0;
          if (fromTop < edge) by = -Math.ceil((edge - fromTop) / 8);
          else if (fromBottom < edge) by = Math.ceil((edge - fromBottom) / 8);
          if (by === 0) continue;

          const before = element.scrollTop;
          element.scrollTop += by;

          // It moved, so this box is the one handling the edge and the ones
          // outside it should stay where they are. If it did not, it is at its
          // limit and the next box out gets the chance — which is the whole
          // reason this is a chain.
          if (element.scrollTop !== before) {
            moved = true;
            break;
          }
        }
      }

      if (moved || dirty.current) {
        dirty.current = false;
        retargetRef.current?.(pointerY.current);
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

      scrollers.current = scrollersOf(node).map((element) => {
        const box = element.getBoundingClientRect();
        return { element, top: box.top, bottom: box.bottom };
      });
      pointerY.current = event.clientY;
      travelled.current = false;
      remeasure.current = true;
      held.current = id;
      grip.current = {
        pointerY: event.clientY + scrolled(),
        top: node.getBoundingClientRect().top + scrolled(),
      };
      // Its own compositing layer, for the length of the drag.
      //
      // Without it the browser **repaints** the row on every frame rather than
      // moving a layer it has already drawn. On a menu item that is cheap. On a
      // section — a header, three cards, three photographs, six buttons — it is
      // not, and the drag stutters in a way no amount of doing less JavaScript
      // fixes, because the work is in the compositor rather than in the script.
      //
      // Set here and cleared on release rather than left in the stylesheet:
      // `will-change` on every row all the time is the documented way to make a
      // page slower, not faster.
      node.style.willChange = "transform";

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
      // A few pixels of slack, so a press that is really a click does not
      // count as travel and start the list moving.
      if (
        Math.abs(event.clientY - (grip.current?.pointerY ?? 0) + scrolled()) > 4
      ) {
        travelled.current = true;
      }
      // Recorded, not acted on. A pointer reports far more often than the
      // screen refreshes — more still once coalesced events are delivered — and
      // moving the row twice between two frames is work nobody can see. The
      // frame loop below does it once, which is as often as it can matter.
      pointerY.current = event.clientY;
      dirty.current = true;
    },
    [scrolled],
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
    positionRef.current = position;
    retargetRef.current = retarget;
    moveRef.current = moveTo;
    announceRef.current = announce;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const present: [string, HTMLElement][] = [];
    nodes.current.clear();
    for (const id of order) {
      const node = rowNode(id);
      if (node) {
        present.push([id, node]);
        nodes.current.set(id, node);
      }
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
      if (
        remeasure.current ||
        (held.current === null && performance.now() > settleBy.current)
      ) {
        remeasure.current = false;
        const idle = scrolled();
        for (const [id, node] of present) {
          const box = node.getBoundingClientRect();
          lastTop.current.set(id, box.top + idle);
          heights.current.set(id, box.height);
        }
      }
      return;
    }

    // 1. Neutralise, so what is measured is layout rather than paint.
    for (const [, node] of present) {
      node.style.transition = "none";
      node.style.transform = "";
    }

    // 2. Measure. One forced reflow for the whole list, not one per row.
    const offset = scrolled();
    const tops = new Map<string, number>();
    for (const [id, node] of present) {
      const box = node.getBoundingClientRect();
      tops.set(id, box.top + offset);
      heights.current.set(id, box.height);
    }

    orderRef.current = order;

    // 3. Invert, and play.
    for (const [id, node] of present) {
      const top = tops.get(id) as number;
      const before = lastTop.current.get(id);
      lastTop.current.set(id, top);
      shifted.current.set(id, 0);

      // The dragged row answers to the pointer, not to this. Its baseline has
      // just moved though, so it is put back under the cursor immediately —
      // within this same frame, so nothing is ever painted at zero.
      //
      // Positioned, never retargeted: deciding here would `setState` inside a
      // layout effect, which React flushes synchronously, which runs this
      // again. See `position`.
      if (id === held.current) {
        positionRef.current?.(pointerY.current);
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
        // Lifted while it is the one being moved, so the eye can follow it
        // over the rows it is passing.
        moving === id && lifted,
      ),
    }),
    [lifted, moving],
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
    /**
     * The row currently being carried, if any.
     *
     * Exposed so a list can render that one row differently — a menu section
     * carries only its header, because carrying the whole block means an opaque
     * slab the height of a screen passing over the list and hiding it. What is
     * being reordered is the *section*, and its heading is the part that says
     * which section it is.
     *
     * Changing a row's size while it is carried is safe **only at the moment
     * the drag begins**, which is when this changes: everything is re-measured
     * on that layout, and nothing has been transformed yet.
     */
    movingId: moving,
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
