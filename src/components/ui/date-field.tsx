"use client";

import DatePicker from "react-datepicker";

import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";
import { BUSINESS_TIMEZONE, fromWallClock, toWallClock } from "@/lib/time";

import { useFieldWiring } from "./field";
import { cx } from "./index";

/**
 * A moment in time, chosen in Beirut's clock.
 *
 * ## This is the case `TimeField` is *not*
 *
 * `store_hours.opens_at` is text — a wall-clock reading with no date and no
 * zone — so its picker deliberately converts nothing. This is the opposite: a
 * `timestamptz` is an **instant**, and the operator is picking it by reading a
 * clock in Beirut. Both facts have to be honoured, and the conversion between
 * them is the entire job of this component.
 *
 * Getting it wrong is invisible. A promotion set to end "at midnight" would end
 * at 21:00 or 03:00 for an operator whose laptop is on another zone, and the
 * screen would show exactly what they typed either way. So:
 *
 * - **Out**: the stored instant is rendered as the wall clock a Beirut clock
 *   showed at that moment, and handed to the picker as a local `Date` carrying
 *   those numbers. The picker never sees the instant.
 * - **In**: the numbers the picker returns are read back as a Beirut wall clock
 *   and turned into an instant by `fromWallClock`, which resolves the offset per
 *   instant so the two DST changes a year are not an hour out.
 *
 * The `Date` in between is a carrier for six numbers, never a moment. Reading
 * it with `getTime()` anywhere would reintroduce the machine's zone.
 *
 * The zone is named on screen for the same reason the hours panel names it: a
 * time with no zone is an assertion about whose clock it came from.
 */
export function DateField({
  value,
  onChange,
  disabled = false,
  invalid,
  className,
}: {
  /** ISO instant, or null for "no date". */
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const field = useFieldWiring();
  const clock = useClock();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <div className="flex flex-col gap-xxs">
      <DatePicker
        id={field?.id}
        selected={toLocalCarrier(value)}
        onChange={(date: Date | null) => onChange(toInstant(date))}
        disabled={disabled}
        showTimeSelect
        timeIntervals={30}
        timeCaption={t("hours.time")}
        // Day-first always, and the clock in the shop's format. Both are
        // stated rather than inherited: what a date reads like should be the
        // same for everybody who opens the dashboard, and `app_settings` — not
        // the machine's locale — is what settles the half of it that is a
        // choice.
        dateFormat={
          clock.clock24h ? "dd MMM yyyy, HH:mm" : "dd MMM yyyy, h:mm aa"
        }
        timeFormat={clock.clock24h ? "HH:mm" : "h:mm aa"}
        placeholderText={t("promotions.noDate")}
        isClearable
        aria-describedby={field?.describedBy}
        aria-invalid={isInvalid ? "true" : undefined}
        className={cx(
          clock.clock24h ? "w-[220px]" : "w-[240px]",
          "rounded-md border bg-surface px-md py-sm text-[14px] tabular-nums",
          isInvalid ? "border-danger" : "border-border",
          className,
        )}
        wrapperClassName="shrink-0"
        popperPlacement="bottom-start"
      />
      <span className="ps-md text-[11px] text-text-faint">
        {t("promotions.inZone", { zone: BUSINESS_TIMEZONE })}
      </span>
    </div>
  );
}

/**
 * The instant, as the six numbers a Beirut clock showed.
 *
 * Built as a *local* `Date` because that is the only shape the picker reads —
 * it will display and edit the numbers in the machine's zone, which is exactly
 * what is wanted once the numbers are already Beirut's.
 */
function toLocalCarrier(value: string | null): Date | null {
  if (!value) return null;
  const clock = toWallClock(new Date(value));
  return new Date(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    0,
    0,
  );
}

/** The numbers back, read as Beirut's clock rather than the machine's. */
function toInstant(date: Date | null): string | null {
  if (!date) return null;
  return fromWallClock({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }).toISOString();
}

/**
 * Two dates as one control, for a range of **whole days**.
 *
 * ## Why not two `DateField`s
 *
 * Two boxes ask the same question twice and answer neither: a from and a to
 * that mean nothing apart are shown apart, each with its own calendar, so the
 * one thing a person is actually choosing — the *span* — is never on screen.
 * `react-datepicker` has a range mode, and in it the calendar shades the days
 * between as they are picked, which is the whole point: the answer is visible
 * while it is being given.
 *
 * ## No time of day here, deliberately
 *
 * Unlike `DateField` this picks *calendar days*, because a report's range is
 * days — "1 to 31 August", not "from 00:00 on the 1st". The instants it hands
 * back are each day's Beirut midnight, and the caller decides what the far end
 * means (`customRange` makes it inclusive by taking the following midnight).
 * Offering a time here would let somebody set a range ending at 14:30 and get a
 * half-day nobody asked for.
 *
 * The conversion is `DateField`'s, for `DateField`'s reasons: the `Date` the
 * picker works in is a carrier for three numbers, never a moment.
 */
export function DateRangeField({
  from,
  to,
  onChange,
  disabled = false,
  className,
}: {
  /** ISO instants, or null while a range is half-chosen. */
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const field = useFieldWiring();

  return (
    <div className="flex flex-col gap-xxs">
      <DatePicker
        id={field?.id}
        selectsRange
        startDate={toLocalCarrier(from) ?? undefined}
        endDate={toLocalCarrier(to) ?? undefined}
        onChange={(dates) => {
          // In range mode the picker hands back a pair, and the second is null
          // until the second click. That half-state is passed straight on
          // rather than swallowed: it is what lets the screen keep showing the
          // preset until a whole range exists.
          const [start, end] = dates as [Date | null, Date | null];
          onChange(toStartOfDay(start), toStartOfDay(end));
        }}
        disabled={disabled}
        monthsShown={2}
        dateFormat="dd MMM yyyy"
        placeholderText={t("reports.rangePlaceholder")}
        isClearable
        aria-describedby={field?.describedBy}
        className={cx(
          "w-[260px] rounded-md border border-border bg-surface px-md py-sm text-[14px] tabular-nums",
          className,
        )}
        wrapperClassName="shrink-0"
        popperPlacement="bottom-start"
      />
      <span className="ps-md text-[11px] text-text-faint">
        {t("promotions.inZone", { zone: BUSINESS_TIMEZONE })}
      </span>
    </div>
  );
}

/** A picked day as the instant Beirut's clock struck midnight on it. */
function toStartOfDay(date: Date | null): string | null {
  if (!date) return null;
  return fromWallClock({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }).toISOString();
}
