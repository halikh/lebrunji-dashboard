import { toWallClock } from "@/lib/time";
import { isOpenAt, type DayWindow } from "@/lib/week";

/**
 * "Open, closes 23:00" / "Closed, opens Mon 09:00" — the line Google Business
 * Profile puts under a place's name, and the one an operator actually needs:
 * not only *whether* a shop is open but how long that stays true.
 *
 * Pure, and read through `isOpenAt`, so it cannot disagree with the green dot
 * beside it: a moment is only reported as a change if `isOpenAt` says the
 * state really is different there. Back-to-back shifts (15:00 close, 15:00
 * open) are therefore no change at all, and a week of 00:00–00:00 days has
 * none — it is open around the clock.
 */

const WEEK = 7 * 1440;

export type NextChange = {
  open: boolean;
  /**
   * When that stops being true, or null when it never does: open around the
   * clock (no rows, or every minute covered).
   */
  at: {
    /** 0–6, Sunday first. */
    dayOfWeek: number;
    /** `HH:MM`, wall clock. */
    time: string;
    /** 0 today, 1 tomorrow, … up to 7 (the same weekday next week). */
    daysAhead: number;
  } | null;
};

function minutes(time: string): number | null {
  const parts = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!parts) return null;
  const hours = Number(parts[1]);
  const value = Number(parts[2]);
  if (hours > 23 || value > 59) return null;
  return hours * 60 + value;
}

function clockOf(minuteOfDay: number): string {
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(
    minuteOfDay % 60,
  ).padStart(2, "0")}`;
}

/** The next change of state after `time` on `dayOfWeek`. */
export function nextChange(
  week: DayWindow[],
  dayOfWeek: number,
  time: string,
): NextChange {
  // No rows is open around the clock (`0170`), as the app reads it.
  if (week.length === 0) return { open: true, at: null };

  const nowMinute = minutes(time) ?? 0;
  const now = dayOfWeek * 1440 + nowMinute;
  const open = isOpenAt(week, dayOfWeek, time);

  // Every moment the state *could* change: each window's opening, and its
  // closing — on the next day when it runs past midnight.
  const candidates = new Set<number>();
  for (const one of week) {
    const opens = minutes(one.opensAt);
    const closes = minutes(one.closesAt);
    if (opens === null || closes === null) continue;
    candidates.add(one.dayOfWeek * 1440 + opens);
    candidates.add(
      ((closes > opens ? one.dayOfWeek : one.dayOfWeek + 1) % 7) * 1440 +
        closes,
    );
  }

  const ahead = [...candidates]
    .map((at) => {
      const distance = (((at - now) % WEEK) + WEEK) % WEEK;
      // A change at this very minute has already happened.
      return distance === 0 ? WEEK : distance;
    })
    .sort((a, b) => a - b);

  for (const distance of ahead) {
    const at = (now + distance) % WEEK;
    const day = Math.floor(at / 1440);
    const clock = clockOf(at % 1440);
    if (isOpenAt(week, day, clock) !== open) {
      return {
        open,
        at: {
          dayOfWeek: day,
          time: clock,
          daysAhead: Math.floor((nowMinute + distance) / 1440),
        },
      };
    }
  }
  return { open, at: null };
}

/** `nextChange` at an instant, on Beirut's clock — see `isOpenNow`. */
export function nextChangeAt(week: DayWindow[], instant: Date): NextChange {
  const clock = toWallClock(instant);
  return nextChange(
    week,
    new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay(),
    `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
  );
}

/** A window that covers the whole day: 00:00 to 00:00 (`isOpenAt` reads it so). */
export function isAllDay(shift: {
  opensAt: string;
  closesAt: string;
}): boolean {
  return shift.opensAt === "00:00" && shift.closesAt === "00:00";
}

/**
 * The places a shop trades from, rolled up: open if any is, and — when none
 * is — the soonest any of them opens. Open around the clock only when every
 * one of them is. A shop with no trading branch is not handled here; the
 * caller says that in its own words.
 */
export function shopChange(changes: NextChange[]): NextChange & {
  openCount: number;
} {
  const open = changes.filter((one) => one.open);
  if (open.length > 0) {
    // One place: its closing time. Several: the last of them to close, so
    // "closes 23:00" is when the shop as a whole stops taking orders.
    const timed = open.filter((one) => one.at !== null);
    const lastToClose =
      timed.length < open.length
        ? null
        : timed.reduce((latest, one) =>
            distanceOf(one) > distanceOf(latest) ? one : latest,
          );
    return { open: true, at: lastToClose?.at ?? null, openCount: open.length };
  }
  const timed = changes.filter((one) => one.at !== null);
  const soonest =
    timed.length === 0
      ? null
      : timed.reduce((soon, one) =>
          distanceOf(one) < distanceOf(soon) ? one : soon,
        );
  return { open: false, at: soonest?.at ?? null, openCount: 0 };
}

function distanceOf(change: NextChange): number {
  if (!change.at) return Infinity;
  return change.at.daysAhead * 1440 + (minutes(change.at.time) ?? 0);
}
