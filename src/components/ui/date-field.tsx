"use client";

import DatePicker from "react-datepicker";

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
        // 24-hour and day-first, stated rather than inherited. The whole point
        // is that a date reads the same to everybody who opens the dashboard.
        dateFormat="dd MMM yyyy, HH:mm"
        timeFormat="HH:mm"
        placeholderText={t("promotions.noDate")}
        isClearable
        aria-describedby={field?.describedBy}
        aria-invalid={isInvalid ? "true" : undefined}
        className={cx(
          "w-[220px] rounded-md border bg-surface px-md py-sm text-[14px] tabular-nums",
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
