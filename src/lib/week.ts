import { toWallClock } from "./time";

/**
 * Reading a shop's week back: is it open, and what does the timetable say.
 *
 * The grid that edits these hours is seven rows of switches and pickers, which
 * is the right shape for *setting* them and the wrong one for *checking* them.
 * "Mon–Fri 11:00–23:00, closed Sunday" is the same information in the form a
 * person actually holds it in, and it is what catches the day that was left
 * shut by accident.
 *
 * Both functions here are pure, and both are tested, because both fail
 * quietly: a wrong summary is a plausible sentence, and a wrong "open now" is a
 * green dot.
 */

export type DayWindow = {
  /** 0–6, Sunday first — the stored convention. */
  dayOfWeek: number;
  /** Wall-clock `HH:MM` in the shop's own country. */
  opensAt: string;
  closesAt: string;
};

/**
 * Is the shop open at this day and time?
 *
 * ## Yesterday can still be open
 *
 * A window whose closing time is at or before its opening time runs past
 * midnight — 18:00–02:00 is a real and common answer. So half past midnight on
 * Tuesday is inside *Monday's* window, and asking only about Tuesday's row
 * would report a busy kitchen as closed.
 *
 * That is the whole subtlety, and it is invisible: the shop is shut in the app
 * for two hours a night, at the busiest end of the evening, and the timetable
 * on screen looks perfectly correct.
 */
export function isOpenAt(
  week: DayWindow[],
  dayOfWeek: number,
  time: string,
): boolean {
  const now = minutes(time);
  if (now === null) return false;

  // A day can hold more than one window — a shop open 07:00–15:00 and again
  // 19:00–01:00 (`0189`) — so every one of them is asked.
  const yesterday = (dayOfWeek + 6) % 7;
  return week.some(
    (day) =>
      (day.dayOfWeek === dayOfWeek && within(day, now, false)) ||
      (day.dayOfWeek === yesterday && within(day, now, true)),
  );
}

/**
 * The first day, Sunday-first, on which two windows cover the same minute —
 * counting an overnight window's tail into the next morning, and Saturday's
 * into Sunday's — or null when none do.
 *
 * The database refuses such a week (`0189`, `branch_hours_refuse_overlap`);
 * asking here first is what lets the editor say which day, before Save.
 * Back to back — 15:00 closing, 15:00 opening — is not an overlap.
 */
export function overlappingDay(week: DayWindow[]): number | null {
  const WEEK = 7 * 1440;
  const laid: { start: number; end: number; index: number }[] = [];

  week.forEach((day, index) => {
    const opens = minutes(day.opensAt);
    const closes = minutes(day.closesAt);
    if (opens === null || closes === null) return;
    const start = day.dayOfWeek * 1440 + opens;
    const end =
      start + (closes > opens ? closes - opens : closes + 1440 - opens);
    laid.push({ start, end, index });
    // Saturday night runs off the end of the week into Sunday morning.
    if (end > WEEK) laid.push({ start: start - WEEK, end: end - WEEK, index });
  });

  let found: number | null = null;
  for (const a of laid) {
    for (const b of laid) {
      if (a.index < b.index && a.start < b.end && b.start < a.end) {
        // The day the clash starts on.
        const day = Math.floor(
          (((Math.max(a.start, b.start) % WEEK) + WEEK) % WEEK) / 1440,
        );
        found = found === null ? day : Math.min(found, day);
      }
    }
  }
  return found;
}

function within(day: DayWindow, now: number, spilled: boolean): boolean {
  const opens = minutes(day.opensAt);
  const closes = minutes(day.closesAt);
  if (opens === null || closes === null) return false;

  const overnight = closes <= opens;

  // Asking about the tail of the *previous* day: only an overnight window
  // reaches here at all, and only the part of it after midnight counts.
  if (spilled) return overnight && now < closes;

  return overnight ? now >= opens : now >= opens && now < closes;
}

function minutes(time: string): number | null {
  const parts = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!parts) return null;
  const hours = Number(parts[1]);
  const value = Number(parts[2]);
  if (hours > 23 || value > 59) return null;
  return hours * 60 + value;
}

/** One window of a day, without the day. */
export type Shift = { opensAt: string; closesAt: string };

export type Span =
  | { open: true; from: number; to: number; windows: Shift[] }
  | { open: false; from: number; to: number };

/**
 * The week as runs of identical days, in the order they are read.
 *
 * `order` is passed in rather than assumed, because the order a week is *read*
 * in is a presentation decision — Monday first here — while the numbers are
 * fixed Sunday-first by the column. Grouping against the wrong one produces
 * spans that are correct and unreadable: `Sun, Mon–Sat` for a shop that opens
 * every day.
 *
 * Runs are only joined when the hours match exactly, so "Mon–Thu 11:00–23:00"
 * and "Fri–Sat 11:00–23:59" stay apart — a half-hour difference on a Friday is
 * exactly the kind of thing somebody is checking for. A day with two shifts
 * joins only another day with the same two.
 */
export function summarise(week: DayWindow[], order: readonly number[]): Span[] {
  const spans: Span[] = [];

  for (const day of order) {
    const windows: Shift[] = week
      .filter((one) => one.dayOfWeek === day)
      .sort((a, b) => (minutes(a.opensAt) ?? 0) - (minutes(b.opensAt) ?? 0))
      .map(({ opensAt, closesAt }) => ({ opensAt, closesAt }));
    const last = spans[spans.length - 1];

    if (windows.length > 0) {
      if (
        last?.open === true &&
        JSON.stringify(last.windows) === JSON.stringify(windows)
      ) {
        last.to = day;
      } else {
        spans.push({ open: true, from: day, to: day, windows });
      }
    } else if (last?.open === false) {
      last.to = day;
    } else {
      spans.push({ open: false, from: day, to: day });
    }
  }

  return spans;
}

/**
 * Is this week open **now**, in Beirut?
 *
 * `isOpenAt` takes a day and a time and is deliberately pure — it is what the
 * hours editor asks about a draft, and about hypothetical moments. This is the
 * one question the rest of the product actually has, and it is asked in three
 * places about drivers alone: the badge on a row, the filter tabs, and which
 * names the dispatch dialog offers.
 *
 * It lives here rather than being written out three times because the two
 * lines it wraps are both easy to get wrong in a way nothing catches. The
 * weekday and the time have to come from the **same** wall clock — reading
 * `getDay()` and then formatting the time separately can straddle midnight and
 * ask about Tuesday's rota at 23:59 on Monday — and both have to be Beirut's,
 * not the machine's, or a laptop that travelled shows a different rota from
 * the one beside it.
 */
export function isOpenNow(week: DayWindow[], now: Date = new Date()): boolean {
  const clock = toWallClock(now);
  return isOpenAt(
    week,
    // The **calendar** weekday of the same wall clock, so the day and the time
    // cannot come from two sides of a midnight. Not `businessWeekday`, which
    // is the trading day's: at 01:00 on Saturday that says Friday, and
    // `isOpenAt` would then look for Friday's 01:00 and Thursday's spill,
    // missing Friday night's rota entirely. `isOpenAt` handles the spill past
    // midnight itself.
    new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay(),
    `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
  );
}
