"use client";

import { useEffect, useState } from "react";

import type { BadgeTone } from "@/components/ui";
import { t, type TranslationKey } from "@/i18n/translations";
import { formatDate } from "@/lib/time";

/*
 * Where something with an on-switch and a date window stands right now —
 * promotions, bundles and artwork all share the shape. The four answers are the
 * ones an operator asks: is it running, will it, did it, or did somebody stop
 * it.
 *
 * "Paused" wins over the dates: a switched-off promotion inside its window is
 * not live, and one outside it is not worth calling ended — it is off either
 * way, and switching it on is the thing to know about.
 */

export type ScheduleState = "live" | "scheduled" | "ended" | "paused";

export function scheduleState(
  row: { isActive: boolean; startsAt: string | null; endsAt: string | null },
  now: number,
): ScheduleState {
  if (!row.isActive) return "paused";
  if (row.endsAt && new Date(row.endsAt).getTime() <= now) return "ended";
  if (row.startsAt && new Date(row.startsAt).getTime() > now) {
    return "scheduled";
  }
  return "live";
}

export const SCHEDULE_TONE: Record<ScheduleState, BadgeTone> = {
  live: "success",
  scheduled: "info",
  paused: "neutral",
  ended: "neutral",
};

/**
 * The current time, ticking once a minute.
 *
 * A list left open across midnight, or across the moment a promotion starts,
 * should move the row from Scheduled to Live without a reload. A minute is as
 * fine as a date-only window needs.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * A date window in words — "1 Nov to 30 Nov", "Until 30 Nov", "From 1 Nov",
 * or the namespace's own sentence for no dates at all. Dates are the business
 * calendar's (Beirut), via `formatDate`.
 */
export function describeDates(
  window: { startsAt: string | null; endsAt: string | null },
  keys: {
    between: TranslationKey;
    until: TranslationKey;
    from: TranslationKey;
    always: TranslationKey;
  },
): string {
  const { startsAt, endsAt } = window;
  if (startsAt && endsAt) {
    return t(keys.between, {
      from: formatDate(startsAt),
      to: formatDate(endsAt),
    });
  }
  if (endsAt) return t(keys.until, { to: formatDate(endsAt) });
  if (startsAt) return t(keys.from, { from: formatDate(startsAt) });
  return t(keys.always);
}

/** Whether the end comes at or before the start — the one window rule. */
export function windowBackwards(
  startsAt: string | null,
  endsAt: string | null,
): boolean {
  return Boolean(
    startsAt &&
    endsAt &&
    new Date(endsAt).getTime() <= new Date(startsAt).getTime(),
  );
}
