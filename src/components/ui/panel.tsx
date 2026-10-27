"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { t } from "@/i18n/translations";

import { cx } from "./index";

/**
 * A side panel: detail that opens **over** the screen, not instead of it.
 *
 * ## Why this is not a `<dialog>`
 *
 * `Modal` uses one, and gets a focus trap and an inert page for free. Both are
 * wrong here.
 *
 * The queue behind this panel has to stay live and stay usable: a new order
 * arriving while an operator reads a detail must still appear and still chime,
 * and they must be able to click straight onto another row. A modal makes the
 * page inert, which is precisely the behaviour a modal is for and precisely
 * what this must not do.
 *
 * So it is an ordinary `<aside>`, and the accessibility work that `<dialog>`
 * would have done has to be done deliberately instead:
 *
 * - **Focus moves in on open**, so a keyboard user is not left behind on the
 *   row they clicked, tabbing through the whole queue to reach the panel.
 * - **Focus returns on close**, to whatever opened it.
 * - **Escape closes it**, which is the gesture people try first.
 * - **It is labelled and marked `complementary`**, so a screen reader announces
 *   a region rather than a wall of unattributed text.
 *
 * Focus is deliberately *not* trapped. Tabbing out of an open panel into the
 * queue is a reasonable thing to want here, and trapping would contradict the
 * whole reason this is not a modal.
 */
export function Panel({
  open,
  onClose,
  label,
  docked = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  /**
   * Always a column from `lg` up, whatever `open` says; `open` then only
   * decides the narrow-screen overlay, where there is no room for both.
   *
   * For a screen whose detail is never "closed" — the order queue always has
   * an order selected, and the receipt beside it is the point of the screen.
   */
  docked?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  // `null` is the breakpoint's own default; a number is what the operator
  // dragged it to.
  const [width, setWidth] = useState<number | null>(null);
  const opener = useRef<Element | null>(null);

  // Held in a ref so the effect below runs on open and close only. Callers pass
  // an inline arrow, and with it in the deps every render of the screen behind
  // re-ran the effect — and re-focused the panel, pulling the cursor out of
  // whatever the operator was typing into.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    // Captured now, and used by the cleanup below. `ref.current` read at
    // cleanup time may already be null — the panel unmounts on close, so by
    // then the node this effect was about is gone and focus would never be
    // returned.
    const panel = ref.current;

    opener.current = document.activeElement;
    // The panel itself takes focus rather than its first control: landing on a
    // button means a screen reader starts mid-content, having skipped the
    // heading that says what this is.
    panel?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close.current();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      // Only if focus is still inside the panel. Moving it back after the
      // operator has already clicked something else would yank them away from
      // whatever they had just chosen.
      if (panel?.contains(document.activeElement)) {
        (opener.current as HTMLElement | null)?.focus?.();
      }
    };
  }, [open]);

  if (!open && !docked) return null;

  /**
   * Dragging the left edge, from `lg` up.
   *
   * Measured from the panel's own width at the moment of the press rather than
   * from a stored number, so the first drag starts from whichever of the two
   * default widths the breakpoint picked. Let go narrower than `MIN_WIDTH` and
   * the panel closes — the gesture people make when they want it gone — and
   * since the width lives in this component, the next open starts at the
   * default again rather than at a sliver.
   */
  function onResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    const panel = ref.current;
    if (!panel) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panel.offsetWidth;
    let last = startWidth;

    function onMove(move: PointerEvent) {
      last = startWidth + (startX - move.clientX);
      setWidth(clampWidth(Math.max(last, COLLAPSE_WIDTH)));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      if (last < MIN_WIDTH) {
        setWidth(null);
        close.current();
      } else {
        setWidth(clampWidth(last));
      }
    }
    // On the body as well as the handle: the pointer leaves a 6px strip within
    // a frame, and the text it crosses should not light up as a selection.
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onResizeKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 64 : 16;
    const current = ref.current?.offsetWidth ?? MIN_WIDTH;
    // Keys never collapse it: closing is the button's job, and a held arrow
    // should stop at the narrowest usable width rather than make it vanish.
    const next =
      event.key === "ArrowLeft"
        ? current + step
        : event.key === "ArrowRight"
          ? current - step
          : null;
    if (next === null) return;
    setWidth(Math.max(MIN_WIDTH, clampWidth(next)));
    event.preventDefault();
  }

  return (
    <aside
      ref={ref}
      role="complementary"
      aria-label={label}
      tabIndex={-1}
      style={
        width === null
          ? undefined
          : ({ "--panel-width": `${width}px` } as React.CSSProperties)
      }
      className={cx(
        // `overflow-hidden` so a child that misjudges its own height is
        // clipped by the panel rather than spilling past it — the panel owns
        // its bounds, and a footer escaping out of the bottom should be a
        // visible mistake, not an invisible one.
        "w-full shrink-0 flex-col overflow-hidden border-border bg-surface outline-none",
        // Docked and not opened: the column is there from `lg` up and nowhere
        // below it, so a phone still sees the queue first.
        open ? "flex" : "hidden lg:flex",
        // Full width on a phone, a column beside the queue from `lg` up. Below
        // that there is not enough room for both, and a 380px panel next to a
        // 200px queue serves neither.
        "absolute inset-0 z-10 lg:relative lg:z-auto lg:border-l",
        width === null
          ? "lg:w-[440px] xl:w-[500px]"
          : "lg:w-(--panel-width)",
        "animate-[panel-in_var(--duration-fade)_var(--ease-arrive)]",
      )}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("common.resize")}
        tabIndex={0}
        onPointerDown={onResizeStart}
        onKeyDown={onResizeKey}
        onDoubleClick={() => setWidth(null)}
        className="absolute inset-y-0 left-0 z-20 hidden w-[6px] cursor-col-resize outline-none hover:bg-accent/30 focus-visible:bg-accent/40 lg:block"
      />
      <div className="flex shrink-0 items-center justify-end border-b border-border px-sm py-xxs lg:hidden">
        <button
          type="button"
          onClick={onClose}
          // 40px tall: this is the only way out on a phone, where it is
          // pressed with a thumb rather than aimed at with a pointer.
          className="flex min-h-[40px] items-center rounded-md px-md text-[14px] font-semibold text-text"
        >
          {t("common.close")}
        </button>
      </div>
      {children}
    </aside>
  );
}

/** Narrower than this and the receipt's lines start breaking mid-word. */
const MIN_WIDTH = 340;
/** How far the drag follows below `MIN_WIDTH` before it reads as "close". */
const COLLAPSE_WIDTH = 240;

/** Never so wide that the queue beside it is squeezed out of use. */
function clampWidth(width: number) {
  const max = Math.max(MIN_WIDTH, Math.min(960, window.innerWidth - 520));
  return Math.round(Math.min(Math.max(width, COLLAPSE_WIDTH), max));
}
