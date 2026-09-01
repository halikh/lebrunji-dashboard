import { businessWeekday, toWallClock } from "./time";

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

  const today = week.find((day) => day.dayOfWeek === dayOfWeek);
  if (today && within(today, now, false)) return true;

  const yesterday = week.find((day) => day.dayOfWeek === (dayOfWeek + 6) % 7);
  return yesterday ? within(yesterday, now, true) : false;
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

export type Span =
  | { open: true; from: number; to: number; opensAt: string; closesAt: string }
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
 * exactly the kind of thing somebody is checking for.
 */
export function summarise(week: DayWindow[], order: readonly number[]): Span[] {
  const spans: Span[] = [];

  for (const day of order) {
    const found = week.find((one) => one.dayOfWeek === day);
    const last = spans[spans.length - 1];

    if (found) {
      if (
        last?.open === true &&
        last.opensAt === found.opensAt &&
        last.closesAt === found.closesAt
      ) {
        last.to = day;
      } else {
        spans.push({
          open: true,
          from: day,
          to: day,
          opensAt: found.opensAt,
          closesAt: found.closesAt,
        });
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
    // `businessWeekday` reads the same instant, so the day and the time below
    // cannot come from two sides of a midnight.
    businessWeekday(now),
    `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
  );
}
