"use client";

import type { ReactNode } from "react";

import { cx } from "@/components/ui";
import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";

import { DAY_KEYS } from "./hours";
import type { NextChange } from "./next-change";

/**
 * "Open, closes 23:00" — whether a place takes orders now and until when, in
 * the shape Google Business Profile made everybody's: state first, then the
 * next change. One wording for the shops list, the shop header, the branches
 * list and the hours editor, so the same week never reads two ways.
 */
export function useDescribeChange() {
  const clock = useClock();
  return (change: NextChange, { unset = false } = {}): string => {
    if (unset) return t("hours.status.noHours");
    const at = change.at;
    if (!at) {
      return change.open ? t("hours.status.allDay") : t("hours.closedNow");
    }
    const params = {
      time: clock.hhmm(at.time),
      day: t(DAY_KEYS[at.dayOfWeek]),
    };
    if (change.open) {
      return at.daysAhead === 0
        ? t("hours.status.closesToday", params)
        : at.daysAhead === 1
          ? t("hours.status.closesTomorrow", params)
          : t("hours.status.closesOn", params);
    }
    return at.daysAhead === 0
      ? t("hours.status.opensToday", params)
      : at.daysAhead === 1
        ? t("hours.status.opensTomorrow", params)
        : t("hours.status.opensOn", params);
  };
}

export type StatusTone = "open" | "closed" | "warning" | "muted";

/** A dot and a short line. Colour carries the state; the words carry the time. */
export function StatusLine({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex min-w-0 items-center gap-1.5 text-[12.5px]",
        tone === "open" && "text-success-ink",
        tone === "warning" && "text-warning-ink",
        (tone === "closed" || tone === "muted") && "text-ink-3",
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          "size-1.5 shrink-0 rounded-full",
          tone === "open" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "closed" && "bg-ink-4",
          tone === "muted" && "bg-line-strong",
        )}
      />
      <span className="truncate">{children}</span>
    </span>
  );
}
