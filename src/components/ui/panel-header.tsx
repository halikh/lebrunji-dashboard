"use client";

import type { ReactNode } from "react";

import { t } from "@/i18n/translations";

/**
 * The bar at the top of a side panel: what this is, and the way out.
 *
 * ## Written six times, and missing from two
 *
 * Every panel in the dashboard had its own copy of this — the same flex row,
 * the same 30px circle, the same hand-drawn cross. The settings panels for help
 * topics and legal sections had **none**, which is how the omission was found:
 * a form opened with no title saying what it was editing and no button to close
 * it, on the one screen where the panel is reached from a list of near-identical
 * rows.
 *
 * That is the shape the plan warns about — a convention repeated at each call
 * site is one that will be missed, and it was missed on the seventh and eighth.
 *
 * ## Escape already works; the button is for the pointer
 *
 * `Panel` is built on the native `<dialog>`, so Escape closes it and focus
 * returns to the trigger without anything here. The cross exists for somebody
 * using a mouse, which is why it is `lg:flex` — below that breakpoint the panel
 * is full-width and the platform's own back gesture is the way out.
 */
export function PanelHeader({
  title,
  onClose,
  children,
}: {
  /** A string, or markup where the title is something like a copyable code. */
  title: ReactNode;
  onClose: () => void;
  /** Anything under the title — a timestamp, a link, a status. */
  children?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-start gap-md border-b border-border p-xxl">
      <div className="flex min-w-0 flex-grow flex-col gap-xxs">
        {typeof title === "string" ? (
          <h2 className="truncate text-[20px]">{title}</h2>
        ) : (
          title
        )}
        {children}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        className="hidden size-[30px] shrink-0 items-center justify-center rounded-full border border-border text-text-soft hover:bg-neutral-fill lg:flex"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
