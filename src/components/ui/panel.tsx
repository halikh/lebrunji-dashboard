"use client";

import { useEffect, useRef, type ReactNode } from "react";

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
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);

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
      if (event.key === "Escape") onClose();
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside
      ref={ref}
      role="complementary"
      aria-label={label}
      tabIndex={-1}
      className={cx(
        "flex w-full shrink-0 flex-col border-border bg-surface outline-none",
        // Full width on a phone, a column beside the queue from `lg` up. Below
        // that there is not enough room for both, and a 380px panel next to a
        // 200px queue serves neither.
        "absolute inset-0 z-10 lg:relative lg:z-auto lg:w-[420px] lg:border-l",
        "animate-[panel-in_var(--duration-fade)_var(--ease-arrive)]",
      )}
    >
      <div className="flex shrink-0 items-center justify-end border-b border-border px-lg py-sm lg:hidden">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-md py-xs text-[14px] font-semibold text-primary"
        >
          {t("common.close")}
        </button>
      </div>
      {children}
    </aside>
  );
}
