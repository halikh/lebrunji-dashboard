"use client";

import { AlarmClock, Clock } from "lucide-react";
import { useEffect, useState } from "react";

import { cx } from "@/components/ui";
import { t } from "@/i18n/translations";
import { isFinishedSlug } from "@/lib/order-status";
import { formatRelative } from "@/lib/time";

/**
 * How long an order has been waiting, and when that becomes a problem.
 *
 * ## Measured from placement, because that is all the order carries
 *
 * Order consoles (Uber Eats Manager, Deliveroo Restaurant Hub, Toast's KDS)
 * count the time an order has sat in its *current* step. `order_stores` keeps
 * only where a portion stands, not when it got there, so the honest clock here
 * is the one the customer is watching: minutes since they pressed Place. The
 * thresholds below are set on that clock — a confirmed order is late when the
 * customer has waited long enough that it should be on a bike, whatever time
 * it was confirmed at. A per-step clock needs a status timestamp (migration).
 *
 * ## Thresholds in minutes since placement
 *
 * `warn` turns the age amber, `late` turns it red and marks the row. Placed is
 * tight because an unanswered order is a customer looking at "waiting for the
 * shop"; the later steps follow a delivery promise of roughly three quarters
 * of an hour. Constants rather than a setting until the team asks to tune them
 * — a setting would need a column on `app_settings`.
 */
const THRESHOLDS: Record<string, { warn: number; late: number }> = {
  ordered: { warn: 3, late: 6 },
  confirmed: { warn: 20, late: 35 },
  driverSent: { warn: 45, late: 60 },
};

export type Urgency = "calm" | "warn" | "late";

/**
 * A clock that re-renders every `intervalMs`, so a waiting time keeps counting
 * on a screen nobody touches. Elapsed time is the same in every timezone, so
 * the machine's `Date.now()` is the right source for it.
 */
export function useTick(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function minutesSince(instant: string, now: number): number {
  return Math.max(0, (now - new Date(instant).getTime()) / 60_000);
}

export function urgencyOf(
  slug: string | undefined,
  placedAt: string,
  now: number,
): Urgency {
  const limits = slug ? THRESHOLDS[slug] : undefined;
  if (!limits) return "calm";
  const minutes = minutesSince(placedAt, now);
  if (minutes >= limits.late) return "late";
  if (minutes >= limits.warn) return "warn";
  return "calm";
}

/** `Just now`, `4 min`, `1 h 12 min`, `3 d` — short enough for a queue row. */
export function formatWait(minutes: number): string {
  const whole = Math.floor(minutes);
  if (whole < 1) return t("orders.waitJustNow");
  if (whole < 60) return t("orders.waitMinutes", { count: whole });
  const hours = Math.floor(whole / 60);
  if (hours < 24) {
    const rest = whole % 60;
    return rest === 0
      ? t("orders.waitHours", { hours })
      : t("orders.waitHoursMinutes", { hours, minutes: rest });
  }
  return t("orders.waitDays", { count: Math.floor(hours / 24) });
}

/**
 * The waiting time of a live order, coloured by urgency; for a finished one,
 * just how long ago it was placed, uncoloured — nothing is waiting any more.
 */
export function OrderAge({
  placedAt,
  slug,
  now,
  className,
  icon,
}: {
  placedAt: string;
  slug: string | undefined;
  now: number;
  className?: string;
  /** A clock glyph before the time, for places where it stands alone. */
  icon?: boolean;
}) {
  if (!slug || isFinishedSlug(slug)) {
    return (
      <span className={cx("text-ink-4", className)}>
        {formatRelative(placedAt, new Date(now))}
      </span>
    );
  }
  const urgency = urgencyOf(slug, placedAt, now);
  const wait = formatWait(minutesSince(placedAt, now));
  return (
    <span
      title={
        urgency === "late"
          ? t("orders.waitLateHint", { time: wait })
          : t("orders.waitHint", { time: wait })
      }
      className={cx(
        "inline-flex items-center gap-1 tabular-nums",
        urgency === "late" && "font-semibold text-danger-ink",
        urgency === "warn" && "font-medium text-warning-ink",
        urgency === "calm" && "text-ink-3",
        className,
      )}
    >
      {urgency === "late" ? (
        <AlarmClock aria-hidden className="size-3.5 shrink-0" />
      ) : (
        icon && <Clock aria-hidden className="size-3.5 shrink-0" />
      )}
      {wait}
      {urgency === "late" && (
        <span className="sr-only">{t("orders.waitLateShort")}</span>
      )}
    </span>
  );
}
