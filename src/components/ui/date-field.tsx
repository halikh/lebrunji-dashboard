"use client";

import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";
import {
  businessTimezone,
  formatDate,
  formatTime,
  fromWallClock,
  toWallClock,
} from "@/lib/time";

import { Button } from "./button";
import { cx } from "./cx";
import { Select } from "./select";

/**
 * A moment in time, chosen on Beirut's clock.
 *
 * ## This is the case `TimeField` is *not*
 *
 * `store_hours.opens_at` is text and converts nothing. A `timestamptz` is an
 * **instant**, picked by reading a clock in Beirut, and the conversion
 * between the two is this component's whole job. Getting it wrong is
 * invisible: a promotion set to end "at midnight" would end at 21:00 or 03:00
 * for an operator whose laptop is on another zone, and the screen would show
 * exactly what they typed either way. So:
 *
 * - **Out**: the stored instant becomes the wall clock Beirut showed at that
 *   moment (`toWallClock`). The calendar only ever sees those numbers.
 * - **In**: the numbers picked are read back as a Beirut wall clock and made
 *   an instant by `fromWallClock`, which resolves the offset per instant so
 *   the two DST changes a year are not an hour out.
 *
 * The calendar is drawn here (no picker library), on plain year/month/day
 * numbers; the only `Date` arithmetic is UTC calendar arithmetic on numbers
 * that are already Beirut's, so the machine's zone cannot reach the answer.
 * The zone is named under the field: a time with no zone is an assertion
 * about whose clock it came from.
 */

type Day = { year: number; month: number; day: number };

const keyOf = (d: Day) => d.year * 10000 + d.month * 100 + d.day;
const sameDay = (a: Day | null, b: Day | null) =>
  !!a && !!b && keyOf(a) === keyOf(b);

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday-first column (0–6) of a day. */
function columnOf(d: Day): number {
  return (new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay() + 6) % 7;
}

function addDays(d: Day, by: number): Day {
  const moved = new Date(Date.UTC(d.year, d.month - 1, d.day + by));
  return {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  };
}

function addMonths(view: { year: number; month: number }, by: number) {
  const index = view.year * 12 + (view.month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The Beirut calendar day an instant fell on. */
function dayOf(value: string | null): Day | null {
  if (!value) return null;
  const clock = toWallClock(new Date(value));
  return { year: clock.year, month: clock.month, day: clock.day };
}

function today(): Day {
  const clock = toWallClock(new Date());
  return { year: clock.year, month: clock.month, day: clock.day };
}

/** "30 Aug 2026" for a calendar day — noon is unambiguously on it. */
function dayLabel(d: Day): string {
  return formatDate(fromWallClock({ ...d, hour: 12 }));
}

/* ───────────────────────────── Calendar ─────────────────────────── */

function Calendar({
  view,
  onView,
  months,
  isSelected,
  rangeOf,
  onPick,
  onHover,
  initialFocus,
}: {
  view: { year: number; month: number };
  onView: (view: { year: number; month: number }) => void;
  months: 1 | 2;
  isSelected: (d: Day) => boolean;
  /** For a range: where this day sits in it. */
  rangeOf?: (d: Day) => "start" | "end" | "both" | "inside" | null;
  onPick: (d: Day) => void;
  onHover?: (d: Day | null) => void;
  initialFocus: Day;
}) {
  const [focus, setFocus] = useState<Day>(initialFocus);
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const now = today();
  const monthNames = t("controls.months").split(",");
  const weekdays = t("controls.weekdays").split(",");

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${keyOf(focus)}"]`)
      ?.focus();
  }, [focus, view]);

  function move(next: Day) {
    moved.current = true;
    setFocus(next);
    const first = keyOf({ ...view, day: 1 });
    const lastView = addMonths(view, months - 1);
    const last = keyOf({
      ...lastView,
      day: daysIn(lastView.year, lastView.month),
    });
    const key = keyOf(next);
    if (key < first) onView({ year: next.year, month: next.month });
    else if (key > last)
      onView(addMonths({ year: next.year, month: next.month }, -(months - 1)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const by: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    if (event.key in by) {
      event.preventDefault();
      let step = by[event.key];
      if (rtl && Math.abs(step) === 1) step = -step;
      move(addDays(focus, step));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const target = addMonths(focus, event.key === "PageUp" ? -1 : 1);
      move({
        ...target,
        day: Math.min(focus.day, daysIn(target.year, target.month)),
      });
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const column = columnOf(focus);
      move(addDays(focus, event.key === "Home" ? -column : 6 - column));
    }
  }

  const monthTitle = (m: { year: number; month: number }) =>
    `${monthNames[m.month - 1]} ${m.year}`;
  const shown = Array.from({ length: months }, (_, i) => addMonths(view, i));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("controls.prevMonth")}
          onClick={() => onView(addMonths(view, -1))}
        >
          <ChevronLeft className="rtl:rotate-180" />
        </Button>
        <div className="flex flex-1 justify-around">
          {shown.map((m) => (
            <span
              key={`${m.year}-${m.month}`}
              aria-live="polite"
              className="text-[14px] font-semibold text-ink"
            >
              {monthTitle(m)}
            </span>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("controls.nextMonth")}
          onClick={() => onView(addMonths(view, 1))}
        >
          <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>

      <div
        ref={grid}
        onKeyDown={onKeyDown}
        onMouseLeave={() => onHover?.(null)}
        className="flex gap-6"
      >
        {shown.map((m) => {
          const lead = columnOf({ ...m, day: 1 });
          const count = daysIn(m.year, m.month);
          return (
            <div
              key={`${m.year}-${m.month}`}
              role="group"
              aria-label={monthTitle(m)}
              className="grid grid-cols-7 gap-y-0.5"
            >
              {weekdays.map((w) => (
                <span
                  key={w}
                  aria-hidden
                  className="flex h-7 w-9 items-center justify-center text-[11.5px] font-medium text-ink-4"
                >
                  {w}
                </span>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <span key={`lead-${i}`} aria-hidden />
              ))}
              {Array.from({ length: count }, (_, i) => {
                const d: Day = { ...m, day: i + 1 };
                const selected = isSelected(d);
                const place = rangeOf?.(d) ?? null;
                const isToday = sameDay(d, now);
                const focusable = sameDay(d, focus);
                return (
                  <div
                    key={d.day}
                    className={cx(
                      "flex h-9 w-9 items-center justify-center",
                      place === "inside" && "bg-accent-soft",
                      place === "start" &&
                        "rounded-s-md bg-gradient-to-r from-transparent from-50% to-accent-soft to-50% rtl:bg-gradient-to-l",
                      place === "end" &&
                        "bg-gradient-to-l from-transparent from-50% to-accent-soft to-50% rtl:bg-gradient-to-r",
                    )}
                  >
                    <button
                      type="button"
                      data-day={keyOf(d)}
                      tabIndex={focusable ? 0 : -1}
                      aria-label={dayLabel(d)}
                      aria-pressed={selected}
                      aria-current={isToday ? "date" : undefined}
                      onClick={() => {
                        setFocus(d);
                        onPick(d);
                      }}
                      onMouseEnter={() => onHover?.(d)}
                      onFocus={() => setFocus(d)}
                      className={cx(
                        "relative flex size-8 items-center justify-center rounded-md text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                        selected
                          ? "bg-accent font-semibold text-white hover:bg-accent-hover"
                          : "text-ink hover:bg-hover",
                        isToday && !selected && "font-semibold text-accent-ink",
                      )}
                    >
                      {d.day}
                      {isToday && (
                        <span
                          aria-hidden
                          className={cx(
                            "absolute bottom-1 size-1 rounded-full",
                            selected ? "bg-white" : "bg-accent",
                          )}
                        />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────── Trigger ─────────────────────────── */

const frame =
  "flex h-9 w-full items-center gap-2 rounded-md border border-line-strong bg-surface ps-3 text-start text-[14px] text-ink shadow-xs transition-[border-color,box-shadow] hover:border-ink-4 focus-visible:border-accent focus-visible:shadow-focus focus-visible:outline-none data-[state=open]:border-accent data-[state=open]:shadow-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-3 data-[invalid]:border-danger";

function ZoneNote() {
  return (
    <span className="text-[12px] text-ink-4">
      {t("promotions.inZone", { zone: businessTimezone() })}
    </span>
  );
}

function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={t("common.clear")}
      title={t("common.clear")}
      className="absolute end-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-ink-4 hover:bg-hover hover:text-ink"
    >
      <X className="size-3.5" />
    </button>
  );
}

/* ───────────────────────────── DateField ────────────────────────── */

export function DateField({
  value,
  onChange,
  disabled = false,
  invalid,
  className,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
}: {
  /** ISO instant, or null for "no date". */
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  /** `Field`'s render props. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label"?: string;
}) {
  const clock = useClock();
  const [open, setOpen] = useState(false);
  const picked = value ? toWallClock(new Date(value)) : null;
  const pickedDay = dayOf(value);
  const start = pickedDay ?? today();
  const [view, setView] = useState({ year: start.year, month: start.month });
  const isInvalid = invalid ?? (ariaInvalid === true || ariaInvalid === "true");

  /** Back to an instant, read as Beirut's clock — never the machine's. */
  function emit(d: Day, hour: number, minute: number) {
    onChange(fromWallClock({ ...d, hour, minute }).toISOString());
  }

  const minutes = picked ? picked.hour * 60 + picked.minute : null;
  const slots = Array.from({ length: 48 }, (_, i) => i * 30);
  if (minutes !== null && !slots.includes(minutes)) {
    slots.push(minutes);
    slots.sort((a, b) => a - b);
  }

  return (
    <div className={cx("flex w-60 max-w-full flex-col gap-1", className)}>
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (disabled) return;
          if (next) setView({ year: start.year, month: start.month });
          setOpen(next);
        }}
      >
        <div className="relative">
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              id={id}
              disabled={disabled}
              aria-label={ariaLabel}
              aria-describedby={describedBy}
              data-invalid={isInvalid || undefined}
              aria-haspopup="dialog"
              className={cx(frame, value ? "pe-9" : "pe-3")}
            >
              <CalendarDays
                aria-hidden
                className="size-4 shrink-0 text-ink-3"
              />
              <span
                className={cx(
                  "min-w-0 flex-1 truncate tabular-nums",
                  !value && "text-ink-4",
                )}
              >
                {value
                  ? `${formatDate(value)}, ${formatTime(value, clock.clock24h)}`
                  : t("promotions.noDate")}
              </span>
            </button>
          </PopoverPrimitive.Trigger>
          {value && !disabled && <ClearButton onClear={() => onChange(null)} />}
        </div>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            collisionPadding={8}
            className="z-50 flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 shadow-lg animate-pop-in focus:outline-none"
          >
            <Calendar
              view={view}
              onView={setView}
              months={1}
              initialFocus={pickedDay ?? today()}
              isSelected={(d) => sameDay(d, pickedDay)}
              onPick={(d) => emit(d, picked?.hour ?? 0, picked?.minute ?? 0)}
            />
            <div className="flex items-center gap-2 border-t border-line pt-3">
              <label
                htmlFor={id ? `${id}-time` : undefined}
                className="text-[13px] font-medium text-ink-2"
              >
                {t("controls.time")}
              </label>
              <Select
                id={id ? `${id}-time` : undefined}
                aria-label={t("controls.time")}
                className="flex-1"
                disabled={!pickedDay}
                value={minutes === null ? "" : String(minutes)}
                onChange={(next) => {
                  if (!pickedDay || !next) return;
                  const total = Number(next);
                  emit(pickedDay, Math.floor(total / 60), total % 60);
                }}
                options={slots.map((total) => ({
                  value: String(total),
                  label: clock.hhmm(
                    `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`,
                  ),
                }))}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => setOpen(false)}
              >
                {t("controls.done")}
              </Button>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      <ZoneNote />
    </div>
  );
}

/* ─────────────────────────── DateRangeField ─────────────────────── */

/**
 * Two dates as one control, for a range of **whole days** — a report's
 * "1 to 31 August". The calendar shades the span as it is picked, so the
 * answer is visible while it is being given.
 *
 * No time of day, deliberately: the instants handed back are each day's
 * Beirut midnight, and the caller decides what the far end means
 * (`customRange` makes it inclusive by taking the following midnight). The
 * half-chosen state (`to` null after the first click) is passed straight on,
 * so a screen can keep showing its preset until a whole range exists.
 */
export function DateRangeField({
  from,
  to,
  onChange,
  disabled = false,
  className,
  id,
  "aria-describedby": describedBy,
  "aria-label": ariaLabel,
  hideZone = false,
}: {
  /** ISO instants, or null while a range is half-chosen. */
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  disabled?: boolean;
  className?: string;
  /** `Field`'s render props. */
  id?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
  /** Leave the zone unnamed — for a caller that already says it nearby. */
  hideZone?: boolean;
}) {
  const wide = useWide();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<Day | null>(null);
  const start = dayOf(from);
  const end = dayOf(to);
  const anchorDay = start ?? today();
  const [view, setView] = useState({
    year: anchorDay.year,
    month: anchorDay.month,
  });

  /** A picked day as the instant Beirut's clock struck midnight on it. */
  const midnight = (d: Day) => fromWallClock(d).toISOString();

  function pick(d: Day) {
    if (!start || end || keyOf(d) < keyOf(start)) {
      onChange(midnight(d), null);
      return;
    }
    onChange(midnight(start), midnight(d));
    setHover(null);
    setOpen(false);
  }

  // While half-chosen, the hovered day previews the far end.
  const far =
    end ?? (start && hover && keyOf(hover) >= keyOf(start) ? hover : null);

  function rangeOf(d: Day) {
    if (!start) return null;
    const k = keyOf(d);
    const a = keyOf(start);
    if (!far) return null;
    const b = keyOf(far);
    if (a === b) return null;
    if (k === a) return "start" as const;
    if (k === b) return "end" as const;
    if (k > a && k < b) return "inside" as const;
    return null;
  }

  const label = start
    ? `${dayLabel(start)} – ${end ? dayLabel(end) : "…"}`
    : t("reports.rangePlaceholder");

  return (
    <div className={cx("flex w-full max-w-[280px] flex-col gap-1", className)}>
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (disabled) return;
          if (next) setView({ year: anchorDay.year, month: anchorDay.month });
          else setHover(null);
          setOpen(next);
        }}
      >
        <div className="relative">
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              id={id}
              disabled={disabled}
              aria-label={ariaLabel}
              aria-describedby={describedBy}
              aria-haspopup="dialog"
              className={cx(frame, start ? "pe-9" : "pe-3")}
            >
              <CalendarDays
                aria-hidden
                className="size-4 shrink-0 text-ink-3"
              />
              <span
                className={cx(
                  "min-w-0 flex-1 truncate tabular-nums",
                  !start && "text-ink-4",
                )}
              >
                {label}
              </span>
            </button>
          </PopoverPrimitive.Trigger>
          {start && !disabled && (
            <ClearButton onClear={() => onChange(null, null)} />
          )}
        </div>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            collisionPadding={8}
            className="z-50 rounded-lg border border-line bg-surface p-3 shadow-lg animate-pop-in focus:outline-none"
          >
            <Calendar
              view={view}
              onView={setView}
              // Two months side by side is wider than a phone.
              months={wide ? 2 : 1}
              initialFocus={end ?? anchorDay}
              isSelected={(d) => sameDay(d, start) || sameDay(d, far)}
              rangeOf={rangeOf}
              onPick={pick}
              onHover={setHover}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      {!hideZone && <ZoneNote />}
    </div>
  );
}

/**
 * Whether the window is at least `md` wide — right on the first client render
 * and following a resize. The server says "wide": the popup only renders
 * after a click.
 */
const WIDE = "(min-width: 48rem)";
function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}
