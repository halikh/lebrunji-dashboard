/**
 * Time, in the one timezone the business actually runs in.
 *
 * ## What "the database's timezone" is, precisely
 *
 * Every timestamp in this schema is `timestamptz`, and a `timestamptz` does not
 * store a timezone. It stores an **instant** — a single point on the world's
 * timeline — and Postgres renders it in whatever zone the session asks for.
 * PostgREST asks for UTC, so what arrives here is an ISO string ending in
 * `+00:00`.
 *
 * That means there is no conversion to do on the way *in or out*: an instant is
 * an instant. The conversion is between an instant and a **wall clock** — what
 * a person in Beirut would have seen on a clock at that moment — and that is
 * the only thing this module does.
 *
 * ## Why not the browser's timezone
 *
 * Because it is not the business's. `Intl` will happily report whatever the
 * machine is set to, and the machine is wrong more often than anyone expects: a
 * laptop that travelled, a VM left on UTC, a phone that picked up a roaming
 * network. Every one of those shows the operator a different idea of which
 * orders are "today", and none of them is the shop's.
 *
 * The shop is in Beirut. The day boundary that matters is Beirut's midnight,
 * for everybody looking at the dashboard, from anywhere.
 *
 * ## Why a fixed offset would be wrong
 *
 * Beirut is UTC+2 in winter and UTC+3 in summer, switching on the last Sunday
 * of March and October. Hard-coding either one is right for half the year and
 * silently an hour out for the other half — which, on a day boundary, files a
 * whole hour of trade under the wrong day twice a year. So the zone is named
 * and `Intl` resolves the offset for each instant.
 *
 * ## The seam for later
 *
 * `user_preferences.timezone` exists in the schema, so a merchant operating
 * somewhere else is a future question. The constant below is the single place
 * that answer would come from; nothing else in the dashboard names a zone.
 */

/** The one place a timezone is named. */
export const BUSINESS_TIMEZONE = "Asia/Beirut";

/** A wall-clock reading — what a clock in Beirut would show. */
export type WallClock = {
  year: number;
  /** 1-12, not the 0-11 `Date` uses. Off-by-one here is a month-long bug. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** What a clock in Beirut read at this instant. */
export function toWallClock(instant: Date): WallClock {
  const parts = Object.fromEntries(
    partsFormatter
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // `hour12: false` still renders midnight as `24` in some engines, which
    // would make midnight look like the end of the previous day rather than the
    // start of this one.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * How far ahead of UTC Beirut was at a given instant, in milliseconds.
 *
 * Derived rather than tabulated: reading the wall clock and pretending it were
 * UTC gives a number that differs from the real instant by exactly the offset.
 * That works for any zone and any year's DST rules without this file knowing
 * any of them.
 */
function offsetAt(instantMs: number): number {
  const clock = toWallClock(new Date(instantMs));
  const asIfUtc = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second,
  );
  // Millisecond precision is lost by the formatter and restored here, so the
  // offset is a whole number of minutes rather than an odd few hundred ms.
  return asIfUtc - instantMs + (instantMs % 1000);
}

/**
 * The instant at which a Beirut clock read this.
 *
 * ## Why it looks the offset up twice
 *
 * The first guess uses the offset at the *wrong* instant — the one you get by
 * pretending the wall clock is UTC — which is fine for all but two hours a
 * year. On the DST boundaries that guess lands on the far side of the change
 * and picks the wrong offset by an hour, so the answer is re-derived at the
 * corrected instant.
 *
 * The spring-forward hour (02:00–03:00 on the last Sunday of March) does not
 * exist on a Beirut clock at all. Anything asked for inside it resolves to the
 * instant the clock jumped to, which is the least surprising of the available
 * wrong answers.
 */
export function fromWallClock(
  clock: Partial<WallClock> & Pick<WallClock, "year" | "month" | "day">,
): Date {
  const asIfUtc = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour ?? 0,
    clock.minute ?? 0,
    clock.second ?? 0,
  );

  const firstGuess = asIfUtc - offsetAt(asIfUtc);
  const corrected = asIfUtc - offsetAt(firstGuess);
  return new Date(corrected);
}

/**
 * When the business day begins, on Beirut's clock.
 *
 * Orders are taken 08:00 → 02:00, so a "day" here is a **shift**, not a
 * calendar date: an order placed at 00:40 belongs to the evening that has not
 * finished yet, and filing it under the date the clock has just rolled over to
 * is the difference between a night's takings and two half-nights.
 *
 * That failure is quiet and it lands on the busiest hours. Under a midnight
 * boundary, the "Today" queue empties at midnight while the kitchen is still
 * cooking; an order that arrives at 00:10 and is still unconfirmed appears to
 * be from a different day than the one before it; and the revenue chart shows
 * every late night split across two bars.
 *
 * One number, in one place, because it is the sort of thing that would
 * otherwise be an `8` in five files.
 */
export const BUSINESS_DAY_STARTS_AT = 8;

/**
 * Which shift an instant belongs to, as a calendar date.
 *
 * Everything else in this section is built on it. Before 08:00 the shift is
 * still yesterday's — subtracting the start hour from the wall clock and then
 * taking the date says exactly that, and says it once.
 *
 * The subtraction is done on the **wall clock**, not on the instant, and the
 * difference matters twice a year: on the day the clocks go back, subtracting
 * eight hours from an instant crosses a 25-hour day and lands an hour out.
 * Rolling the numbers through `Date.UTC` is calendar arithmetic on values that
 * are already Beirut's, so nothing about offsets or the machine's zone reaches
 * the answer.
 */
function shiftDate(instant: Date): { year: number; month: number; day: number } {
  const clock = toWallClock(instant);
  const rolled = new Date(
    Date.UTC(
      clock.year,
      clock.month - 1,
      clock.day,
      clock.hour - BUSINESS_DAY_STARTS_AT,
    ),
  );
  return {
    year: rolled.getUTCFullYear(),
    month: rolled.getUTCMonth() + 1,
    day: rolled.getUTCDate(),
  };
}

/**
 * The start of the shift containing `instant` — 08:00 Beirut on its day.
 *
 * This is the day boundary the whole dashboard uses. Called with an instant it
 * answers for *that* shift, so it is correct for any moment, not only for now.
 */
export function startOfBusinessDay(instant: Date = new Date()): Date {
  return fromWallClock({ ...shiftDate(instant), hour: BUSINESS_DAY_STARTS_AT });
}

/** The instant `days` shifts after the one containing `instant`. */
export function startOfBusinessDayPlus(
  days: number,
  instant: Date = new Date(),
): Date {
  const date = shiftDate(instant);
  // Through `Date.UTC` so month and year roll over correctly — `day + 1` on the
  // 31st is not the 32nd.
  const rolled = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return fromWallClock({
    year: rolled.getUTCFullYear(),
    month: rolled.getUTCMonth() + 1,
    day: rolled.getUTCDate(),
    hour: BUSINESS_DAY_STARTS_AT,
  });
}

/** Whether two instants fall in the same shift. */
export function isSameBusinessDay(a: Date, b: Date): boolean {
  const first = shiftDate(a);
  const second = shiftDate(b);
  return (
    first.year === second.year &&
    first.month === second.month &&
    first.day === second.day
  );
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------
//
// Every formatter names the zone. A screen that showed one time in Beirut and
// another in the machine's zone would be worse than one that got them all
// wrong, because the inconsistency is what nobody notices.

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIMEZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `14:32` */
export function formatTime(instant: Date | string): string {
  return timeFormatter.format(asDate(instant));
}

/** `30 Aug 2026` */
export function formatDate(instant: Date | string): string {
  return dateFormatter.format(asDate(instant));
}

/** `30 Aug, 14:32` */
export function formatDateTime(instant: Date | string): string {
  return dateTimeFormatter.format(asDate(instant));
}

/**
 * Which Beirut month an instant fell in, as `2026-08`.
 *
 * A sortable, comparable key for bucketing a history into months — and it has
 * to be Beirut's month, not the machine's. An order placed at 01:00 on the 1st
 * of September in Beirut is still August for anyone whose computer is on UTC,
 * and a chart built from that shows a month's trade sliding into the one before
 * it. Twice a year, at the DST changes, it would slide differently.
 */
export function businessMonthKey(instant: Date | string): string {
  // The *shift's* month, so a 00:40 order on the 1st counts towards the month
  // whose evening it was part of rather than the one that had just begun.
  const date = shiftDate(asDate(instant));
  return `${date.year}-${String(date.month).padStart(2, "0")}`;
}

/**
 * Which day of the week an instant fell on **in Beirut**, `0` Sunday to `6`.
 *
 * The **shift's** weekday, not the calendar's: an order at 00:30 on Saturday
 * belongs to Friday night's trade, which is what a "when are we busy" chart is
 * being read to find.
 *
 * `Date#getDay` answers for the machine, which is the other half of the same
 * bug: 00:30 Saturday in Beirut is still Friday in London, so a chart drawn on
 * a laptop that travelled puts every late order on a different wrong bar.
 *
 * The wall clock is read first and *then* treated as UTC, purely to borrow
 * `getUTCDay`'s calendar arithmetic — the numbers going in are already Beirut's,
 * so nothing about the machine's zone can reach the answer.
 *
 * Sunday-first because that is what `store_hours.day_of_week` stores and what
 * `Date#getDay` returns; screens that show Monday first do that in the
 * presentation layer, deliberately keeping the two orders separate.
 */
export function businessWeekday(instant: Date | string): number {
  const date = shiftDate(asDate(instant));
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

/**
 * The last `count` Beirut months, oldest first, as `2026-08` keys.
 *
 * Walks backwards a month at a time from today's Beirut month rather than
 * subtracting 30 days, which drifts: twelve 30-day steps is 360 days and lands
 * in the wrong month by the fifth one.
 */
export function recentMonthKeys(
  count: number,
  now: Date = new Date(),
): string[] {
  const date = shiftDate(now);
  const keys: string[] = [];

  let year = date.year;
  let month = date.month;

  for (let step = 0; step < count; step += 1) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return keys.reverse();
}

/** `Aug 26` — a month key as a chart label. */
export function formatMonthKey(key: string): string {
  const [year, month] = key.split("-");
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${MONTHS[Number(month) - 1] ?? month} ${year.slice(2)}`;
}

/**
 * `2 minutes ago`.
 *
 * Timezone-free by nature — the distance between two instants is the same
 * everywhere — which is exactly why it is the right thing on a queue row. An
 * absolute time on a live screen makes the reader do the subtraction.
 */
const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

export function formatRelative(
  instant: Date | string,
  now: Date = new Date(),
): string {
  const seconds = Math.round(
    (asDate(instant).getTime() - now.getTime()) / 1000,
  );
  const abs = Math.abs(seconds);

  if (abs < 60) return relativeFormatter.format(Math.round(seconds), "second");
  if (abs < 3600)
    return relativeFormatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400)
    return relativeFormatter.format(Math.round(seconds / 3600), "hour");
  return relativeFormatter.format(Math.round(seconds / 86_400), "day");
}

/**
 * `Today, 14:32` — relative for the day, absolute for the time.
 *
 * What an order detail wants: "3 hours ago" is the wrong precision when
 * somebody is on the phone reading a time back to a customer.
 */
export function formatDayAndTime(
  instant: Date | string,
  now: Date = new Date(),
): string {
  const date = asDate(instant);
  if (isSameBusinessDay(date, now)) return `Today, ${formatTime(date)}`;
  if (isSameBusinessDay(date, startOfBusinessDayPlus(-1, now))) {
    return `Yesterday, ${formatTime(date)}`;
  }
  return formatDateTime(date);
}

/** ISO strings arrive from PostgREST; `Date`s come from the code. */
function asDate(instant: Date | string): Date {
  return instant instanceof Date ? instant : new Date(instant);
}
