"use client";

import DatePicker from "react-datepicker";

import { t } from "@/i18n/translations";

import { useFieldWiring } from "./field";
import { cx } from "./index";

/**
 * A time of day, chosen rather than typed.
 *
 * ## Why a library and not `<input type="time">`
 *
 * The native input looks like the free answer and is not. It renders
 * differently in every browser, and — the part that matters here — it shows
 * 12- or 24-hour according to the *machine's* locale. A shop's hours would read
 * `9:00 PM` on one operator's laptop and `21:00` on the next one's, for the same
 * stored string, which makes two people describing the same shop disagree.
 *
 * A picker settles that: the shop's hours look the same to everybody who opens
 * the dashboard, whatever their computer thinks.
 *
 * ## What it is actually editing
 *
 * `store_hours.opens_at` is **text**, `HH:MM`, wall-clock in the shop's own
 * country — not an instant. So there is deliberately no timezone conversion
 * anywhere here, and `src/lib/time.ts` is not involved: nine in the morning is
 * nine in the morning, and turning it into a moment would ask a question the
 * column does not answer.
 *
 * The `Date` below exists only because the picker's interface is dated. It is
 * built and read on a fixed, arbitrary day, so nothing about the calendar can
 * leak into the value — and the string is produced by hand rather than by
 * `toLocaleTimeString`, which would bring the machine's locale back in by the
 * side door.
 *
 * ## Fifteen minutes
 *
 * Shops open on the quarter hour. The list exists to be scanned, and one entry
 * per minute is 1440 rows nobody reads — while typing stays available for the
 * kitchen that really does close at 22:50.
 */
export function TimeField({
  value,
  onChange,
  disabled = false,
  invalid,
  className,
}: {
  /** `HH:MM`, 24-hour. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const field = useFieldWiring();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <DatePicker
      id={field?.id}
      selected={toDate(value)}
      onChange={(date: Date | null) => onChange(fromDate(date))}
      disabled={disabled}
      showTimeSelect
      showTimeSelectOnly
      timeIntervals={15}
      timeCaption={t("hours.time")}
      // 24-hour, stated rather than inherited. The whole point is that the
      // shop's hours read the same on every machine.
      dateFormat="HH:mm"
      timeFormat="HH:mm"
      placeholderText="09:00"
      aria-describedby={field?.describedBy}
      // The library types this as a string, which is what the attribute is in
      // HTML — React would have taken the boolean.
      aria-invalid={isInvalid ? "true" : undefined}
      className={cx(
        "w-[104px] rounded-md border bg-surface px-md py-sm text-[14px] tabular-nums",
        isInvalid ? "border-danger" : "border-border",
        className,
      )}
      wrapperClassName="shrink-0"
      // Rendered in a portal so the popup is not clipped by the row's own
      // `overflow-hidden`, which is what a grid of these sits inside.
      popperPlacement="bottom-start"
    />
  );
}

/** A fixed day, so only the time survives the round trip. */
function toDate(value: string): Date | null {
  const parts = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!parts) return null;
  const hours = Number(parts[1]);
  const minutes = Number(parts[2]);
  if (hours > 23 || minutes > 59) return null;
  return new Date(2000, 0, 1, hours, minutes, 0, 0);
}

/**
 * Back to `HH:MM`, built by hand.
 *
 * `toLocaleTimeString` would be shorter and would put the machine's locale back
 * into a value that is meant to be independent of it — a device set to
 * `en-US` returns `9:00 AM`, which is not what the column holds.
 */
function fromDate(date: Date | null): string {
  if (!date) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
