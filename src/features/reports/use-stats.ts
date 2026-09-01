"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fromWallClock,
  startOfBusinessDay,
  startOfBusinessDayPlus,
  toWallClock,
} from "@/lib/time";

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

/**
 * A range from two dates a person picked, as the instants a query wants.
 *
 * ## Both ends are Beirut days, and the far end is inclusive
 *
 * Somebody choosing "1 August to 31 August" means the whole of the 31st. So
 * `to` becomes the start of the **next** Beirut day: the range is half-open in
 * the query and inclusive on screen, which is the only pair of those two that
 * is not surprising.
 *
 * Ending at the picked day's own midnight would silently drop a day's trade —
 * and it would drop the most recent one, which is the day somebody choosing a
 * range is most likely to care about.
 *
 * ## Why the pickers' instants are reduced to days first
 *
 * `DateField` hands back an instant, because that is what a `timestamptz`
 * column wants everywhere else in the dashboard. A *range* does not want one:
 * it wants a calendar day, and which day an instant falls on is a question with
 * a different answer in every timezone. `toWallClock` asks it in Beirut, once,
 * and the rest of this function works in numbers.
 */
export function customRange(from: string, to: string) {
  const start = toWallClock(new Date(from));
  const end = toWallClock(new Date(to));

  return {
    from: fromWallClock({
      year: start.year,
      month: start.month,
      day: start.day,
    }),
    // The day *after* the one picked — see above.
    to: fromWallClock({
      year: end.year,
      month: end.month,
      day: end.day + 1,
    }),
  };
}

/**
 * The same span, ending where this one begins.
 *
 * Measured in whole days rather than milliseconds: a period that crosses a DST
 * change is 23 or 25 hours long on one of its days, and subtracting a duration
 * would put the comparison an hour out — twice a year, on the two weeks nobody
 * is looking for an off-by-one.
 */
export function previousOf(from: Date, to: Date) {
  const days = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / 86_400_000),
  );
  const start = toWallClock(from);

  return {
    from: fromWallClock({
      year: start.year,
      month: start.month,
      day: start.day - days,
    }),
    to: from,
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
