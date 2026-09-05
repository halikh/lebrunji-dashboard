"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  formatClockString,
  formatDateTime,
  formatDayAndTime,
  formatHour,
  formatTime,
} from "@/lib/time";

import { fetchAppSettings } from "./api/app-settings";

export const appSettingsKey = ["app-settings"] as const;

/**
 * The settings that belong to the business, wherever they are needed.
 *
 * One key, so the Settings screen and every screen that merely *reads* a
 * setting share a cache entry and a request. That sharing is the whole
 * mechanism behind the clock toggle: `GeneralTab` invalidates this key after a
 * save, and every mounted screen re-renders with the new format.
 */
export function useAppSettings() {
  return useQuery({
    queryKey: appSettingsKey,
    queryFn: fetchAppSettings,
    // Read by every screen that shows a time. It changes when somebody decides
    // it does, and the screen that lets them invalidates it when they do.
    staleTime: 10 * 60_000,
  });
}

/** Times, in whichever shape the shop reads them. */
export type Clock = {
  /** `22:00` rather than `10:00 PM`. */
  clock24h: boolean;
  /** An instant's time of day: `14:32`, or `2:32 PM`. */
  time: (instant: Date | string) => string;
  /** An instant, dated: `30 Aug, 14:32`. */
  dateTime: (instant: Date | string) => string;
  /** An instant, relative for the day: `Today, 14:32`. */
  dayAndTime: (instant: Date | string) => string;
  /** A stored `HH:MM` — opening hours, which are text and not instants. */
  hhmm: (value: string) => string;
  /** A whole hour on its own: `08:00`, or `8:00 AM`. */
  hour: (hour: number) => string;
};

/**
 * Every way this dashboard shows a time, already told which format to use.
 *
 * ## Why a hook rather than a call to `formatTime`
 *
 * `app_settings.clock_24h` was a setting that only ever set itself: it was
 * written to the database, read back into its own toggle, and read by nothing
 * else, while `src/lib/time.ts` formatted everything at `hour12: false`. An
 * operator could switch to a 12-hour clock and watch the whole dashboard go on
 * saying `22:00`.
 *
 * It could not have been fixed inside `time.ts`, because the value is not
 * available where those functions are called — it arrives over the network. A
 * hook is what puts it there, and it is a *hook* rather than a context so
 * nothing has to be mounted for it to work: react-query already dedupes the
 * read, so twenty screens calling this make one request.
 *
 * ## Defaulting to 24-hour while it loads
 *
 * The first paint happens before the settings arrive, so something has to be
 * shown. 24-hour is the safer of the two: it is the value the column defaults
 * to, and a `14:32` that settles into `2:32 PM` a moment later has never been
 * ambiguous, whereas a `2:32` that has not yet learned it needs a `PM` is a
 * time somebody can misread and act on.
 *
 * ## What deliberately does not follow it
 *
 * The **heatmap's hour axis**, which labels four of twenty-four columns and is
 * read as a position on a day rather than as a time, and the stored value in
 * `TimeField`'s `HH:MM` round trip, which is what the database holds and is not
 * a display at all.
 */
export function useClock(): Clock {
  const settings = useAppSettings();
  const clock24h = settings.data?.clock24h ?? true;

  // Memoised on the one thing it depends on, so a screen that passes `clock`
  // into a `useMemo` of its own is not rebuilding it on every render.
  return useMemo(
    () => ({
      clock24h,
      time: (instant) => formatTime(instant, clock24h),
      dateTime: (instant) => formatDateTime(instant, clock24h),
      dayAndTime: (instant) => formatDayAndTime(instant, clock24h),
      hhmm: (value) => formatClockString(value, clock24h),
      hour: (hour) => formatHour(hour, clock24h),
    }),
    [clock24h],
  );
}
