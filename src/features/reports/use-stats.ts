"use client";

import { useQuery } from "@tanstack/react-query";

import { startOfBusinessDay, startOfBusinessDayPlus } from "@/lib/time";

import { fetchStats } from "./api/stats";

export const statsKeys = {
  all: ["stats"] as const,
  range: (from: string, to: string) => ["stats", from, to] as const,
};

/**
 * A range of Beirut days, as the two instants a query wants.
 *
 * ## Why the range is expressed in days and not in hours
 *
 * "Last 30 days" ending at a UTC midnight is thirty days plus or minus two
 * hours of somebody's trade — and a different amount either side of the two DST
 * changes. `startOfBusinessDayPlus` walks the *calendar*, so the boundaries are
 * the moments Beirut's clock struck midnight, whatever the offset was that
 * week.
 *
 * ## Half-open, `[from, to)`
 *
 * An order placed at exactly the boundary belongs to one period, not to both.
 * A closed range would count it in the current period *and* in the previous
 * one, which is the single place one order can visibly move a percentage.
 *
 * `to` is the start of *tomorrow*, so today is included whole — a range ending
 * at this morning's midnight would silently exclude every order placed since
 * breakfast, which on the busiest screen of the day is the worst possible
 * omission.
 */
export function businessRange(days: number, now: Date = new Date()) {
  return {
    from: startOfBusinessDayPlus(-(days - 1), now),
    to: startOfBusinessDayPlus(1, now),
  };
}

/** The same length of range, ending where the current one begins. */
export function previousRange(days: number, now: Date = new Date()) {
  return {
    from: startOfBusinessDayPlus(-(days * 2 - 1), now),
    to: startOfBusinessDayPlus(-(days - 1), now),
  };
}

export function useStats(from: Date, to: Date) {
  return useQuery({
    queryKey: statsKeys.range(from.toISOString(), to.toISOString()),
    queryFn: () => fetchStats(from, to),
    // Aggregates over a window that mostly does not move. A minute of staleness
    // on a revenue figure is not the same kind of wrong as a minute of
    // staleness on the live queue.
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

/** Today, for the "needs you now" block — which is never date-filtered. */
export function today(): Date {
  return startOfBusinessDay();
}
