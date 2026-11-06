"use client";

import {
  CalendarDays,
  ChevronLeft,
  Clock,
  Moon,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  Button,
  Checkbox,
  Popover,
  Switch,
  Tooltip,
  cx,
} from "@/components/ui";
import { TimeField } from "@/components/ui/time-field";
import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";
import { businessTimezone } from "@/lib/time";
import {
  isOpenNow,
  overlappingDay,
  summarise,
  type DayWindow,
  type Shift,
} from "@/lib/week";

import type { DayHours } from "../api/hours";

import { isAllDay, nextChangeAt } from "./next-change";
import { useDescribeChange } from "./open-status";

/**
 * A branch's week.
 *
 * ## One grid, one Save
 *
 * The seven days are one answer to one question — *when is this place open* —
 * and they are almost always set together. So they are edited together, with
 * the week read back beside the grid in the form a person holds it in ("Mon–Fri
 * 11:00–23:00, closed Sunday"), which is what catches the day left shut by
 * accident.
 *
 * ## Closed is the absence of a row — and a closed *week* is not closed
 *
 * `branch_hours` holds a row per window; a day with none is shut. A branch with
 * no rows at all, though, is open **around the clock** (`0170`), so seven
 * closed days would not mean closed. `checkWeek` refuses it, as `0228` does,
 * and names the switch that really does stop orders.
 *
 * ## Copying a day: to the days ticked
 *
 * Google Business Profile's pattern: a day's ⋯ has "Copy to…", which lists the
 * other days with a box each — closed ones too, unticked — and Apply. A ticked
 * closed day opens with those hours. One action rather than the two this
 * replaced ("to every open day" and "to every day"), which differed only in
 * which days they chose for you.
 *
 * ## Shifts, and overnight
 *
 * A day holds up to three windows (`0189`) — 07:00–15:00 then 19:00–01:00 for a
 * shop that shuts for the afternoon. A closing time earlier than the opening
 * one is an overnight window, which is ordinary, and the row says so in words
 * so nobody "fixes" it. Overlaps, midnight included, are named by day before
 * the database refuses them.
 */

/** Stored order: `day_of_week` 0–6, **Sunday first**, as `Date#getDay`. */
const WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Read order: **Monday first**. A presentation decision only — the state is
 * indexed by the stored day throughout, so nothing reaching the database ever
 * passes through a display position.
 */
export const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const DAY_KEYS = [
  "hours.sunday",
  "hours.monday",
  "hours.tuesday",
  "hours.wednesday",
  "hours.thursday",
  "hours.friday",
  "hours.saturday",
] as const;

/** As many as `api_v1_set_branch_hours` takes (`0189`). */
const MAX_SHIFTS = 3;

type DayDraft = { open: boolean; windows: Shift[] };

/** The week being edited, indexed by the *stored* day, 0 = Sunday. */
export type WeekDraft = DayDraft[];

/**
 * A week to start from: the saved rows, and every other day closed with the
 * hours a shop most often keeps, so opening a day is one switch.
 */
export function draftWeek(saved: DayHours[] = []): WeekDraft {
  return WEEK.map((day) => {
    const windows = saved
      .filter((one) => one.dayOfWeek === day)
      .sort((a, b) => a.opensAt.localeCompare(b.opensAt))
      .map(({ opensAt, closesAt }) => ({ opensAt, closesAt }));
    return windows.length > 0
      ? { open: true, windows }
      : { open: false, windows: [{ opensAt: "09:00", closesAt: "22:00" }] };
  });
}

/** The rows to write: one per window of each open day. */
export function weekToHours(week: WeekDraft): DayHours[] {
  return week.flatMap((day, index) =>
    day.open ? day.windows.map((one) => ({ dayOfWeek: index, ...one })) : [],
  );
}

/**
 * What is wrong with a week, if anything: no open day at all (saved, that is
 * no rows — open around the clock, `0228`), an open day missing a time, or two
 * windows covering the same minute.
 */
export function checkWeek(week: WeekDraft): string | null {
  if (!week.some((day) => day.open)) return t("hours.allClosed");
  if (
    week.some(
      (day) =>
        day.open && day.windows.some((one) => !one.opensAt || !one.closesAt),
    )
  ) {
    return t("hours.incomplete");
  }
  const clash = overlappingDay(weekToHours(week));
  return clash === null
    ? null
    : t("hours.overlap", { day: t(DAY_KEYS[clash]) });
}

function crossesMidnight(shift: Shift): boolean {
  return (
    shift.opensAt !== "" &&
    shift.closesAt !== "" &&
    shift.closesAt <= shift.opensAt
  );
}

/** The draft in the shape `lib/week.ts` reads, half-typed windows left out. */
function toWindows(week: WeekDraft): DayWindow[] {
  return weekToHours(week).filter((one) => one.opensAt && one.closesAt);
}

/**
 * The current instant, ticking once a minute — so "open right now" moves on
 * while the page is left open, without reading the clock during render.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Whether a week is open at `now`, in Beirut. No windows is open around the
 * clock, as the app and `place_order` read it.
 */
export function openAt(hours: DayWindow[], now: Date): boolean {
  return hours.length === 0 || isOpenNow(hours, now);
}

/**
 * The week as rows of switches and time pickers, with the read-back beside it.
 *
 * Controlled and with no Save of its own, so it serves the Hours tab, the new
 * shop page and the new branch page alike.
 */
export function WeekEditor({
  week,
  onChange,
  error,
  dirty = false,
}: {
  week: WeekDraft;
  onChange: (week: WeekDraft) => void;
  error?: string | null;
  /** Tells the read-back the week has unsaved changes. */
  dirty?: boolean;
}) {
  function update(day: number, patch: Partial<DayDraft>) {
    onChange(
      week.map((one, index) => (index === day ? { ...one, ...patch } : one)),
    );
  }

  function updateShift(day: number, shift: number, patch: Partial<Shift>) {
    update(day, {
      windows: week[day].windows.map((one, index) =>
        index === shift ? { ...one, ...patch } : one,
      ),
    });
  }

  /**
   * A new shift starts four hours after the last one closes and runs four
   * hours — the afternoon gap a split day usually has, and clear of the shift
   * before it, so adding one does not put an error on screen.
   */
  function addShift(day: number) {
    const windows = week[day].windows;
    const last = windows[windows.length - 1];
    const [h, m] = (last?.closesAt || "15:00").split(":").map(Number);
    const at = (hours: number) =>
      `${String((h + hours) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    update(day, { windows: [...windows, { opensAt: at(4), closesAt: at(8) }] });
  }

  function removeShift(day: number, shift: number) {
    update(day, {
      windows: week[day].windows.filter((_, index) => index !== shift),
    });
  }

  /** One day's hours onto the days ticked, opening any that were shut. */
  function copyTo(day: number, targets: number[]) {
    const windows = week[day].windows;
    onChange(
      week.map((one, index) =>
        targets.includes(index)
          ? { open: true, windows: windows.map((shift) => ({ ...shift })) }
          : one,
      ),
    );
  }

  return (
    <div className="@container">
      <div className="grid grid-cols-1 items-start gap-5 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
            <div className="border-b border-line bg-subtle px-4 py-2.5">
              <p className="text-[13px] font-medium text-ink-2">
                {t("hours.gridTitle")}
              </p>
            </div>
            <ul className="divide-y divide-line">
              {DISPLAY_ORDER.map((index) => (
                <DayRow
                  key={index}
                  index={index}
                  label={t(DAY_KEYS[index])}
                  day={week[index]}
                  onToggle={(open) => update(index, { open })}
                  onShift={(shift, patch) => updateShift(index, shift, patch)}
                  onAdd={() => addShift(index)}
                  onRemove={(shift) => removeShift(index, shift)}
                  onAllDay={(on) =>
                    update(index, {
                      windows: [
                        on
                          ? { opensAt: "00:00", closesAt: "00:00" }
                          : { opensAt: "09:00", closesAt: "22:00" },
                      ],
                    })
                  }
                  onCopyTo={(targets) => copyTo(index, targets)}
                />
              ))}
            </ul>
          </div>

          {error && (
            <p
              role="alert"
              data-invalid="true"
              tabIndex={-1}
              className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger-ink"
            >
              {error}
            </p>
          )}
        </div>

        <HoursSummary hours={toWindows(week)} dirty={dirty} />
      </div>
    </div>
  );
}

function DayRow({
  index,
  label,
  day,
  onToggle,
  onShift,
  onAdd,
  onRemove,
  onAllDay,
  onCopyTo,
}: {
  /** The stored day, 0 = Sunday. */
  index: number;
  label: string;
  day: DayDraft;
  onToggle: (open: boolean) => void;
  onShift: (shift: number, patch: Partial<Shift>) => void;
  onAdd: () => void;
  onRemove: (shift: number) => void;
  /** 00:00–00:00, which every reader takes as the whole day. */
  onAllDay: (on: boolean) => void;
  /** Stored days to copy this day's hours onto. */
  onCopyTo: (targets: number[]) => void;
}) {
  const allDay = day.windows.length === 1 && isAllDay(day.windows[0]);
  const complete = day.windows.every((one) => one.opensAt && one.closesAt);
  return (
    <li
      className={cx(
        "relative flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start",
        !day.open && "bg-subtle/60",
      )}
    >
      {/* A fixed width, so the switches line up down the week and its shape
          can be read without reading the words. */}
      <div className="flex h-9 shrink-0 items-center gap-3 sm:w-44">
        <Switch
          checked={day.open}
          onCheckedChange={onToggle}
          aria-label={t("hours.openOn", { day: label })}
        />
        <span
          className={cx(
            "text-[14px] font-medium",
            day.open ? "text-ink" : "text-ink-3",
          )}
        >
          {label}
        </span>
      </div>

      {day.open && allDay ? (
        <p className="flex h-9 min-w-0 flex-1 items-center gap-2 text-[13.5px] font-medium text-ink">
          <Clock aria-hidden className="size-4 text-ink-3" />
          {t("hours.allDay")}
        </p>
      ) : day.open ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {day.windows.map((shift, at) => (
            <div key={at} className="flex flex-wrap items-center gap-2">
              <TimeField
                value={shift.opensAt}
                onChange={(value) => onShift(at, { opensAt: value })}
                aria-label={t("hours.opensAt", { day: label })}
              />
              <span className="text-[13px] text-ink-3">{t("hours.to")}</span>
              <TimeField
                value={shift.closesAt}
                onChange={(value) => onShift(at, { closesAt: value })}
                aria-label={t("hours.closesAt", { day: label })}
              />
              {crossesMidnight(shift) && (
                <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                  <Moon aria-hidden className="size-3.5" />
                  {t("hours.overnight")}
                </span>
              )}
              {day.windows.length > 1 && (
                <Tooltip content={t("hours.removeShift")}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemove(at)}
                    aria-label={t("hours.removeShiftOn", { day: label })}
                  >
                    <X />
                  </Button>
                </Tooltip>
              )}
            </div>
          ))}
          {day.windows.length < MAX_SHIFTS && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdd}
              className="-ms-2 w-fit text-ink-3"
            >
              <Plus />
              {t("hours.addShift")}
            </Button>
          )}
        </div>
      ) : (
        <p className="flex h-9 flex-1 items-center text-[13.5px] text-ink-4">
          {t("hours.closedAllDay")}
        </p>
      )}

      {day.open && (
        <div className="absolute end-3 top-3 sm:static sm:flex sm:h-9 sm:items-center">
          <DayActions
            index={index}
            label={label}
            allDay={allDay}
            complete={complete}
            onAllDay={onAllDay}
            onCopyTo={onCopyTo}
          />
        </div>
      )}
    </li>
  );
}

/**
 * A day's ⋯: "Open 24 hours" (or back to set hours), and "Copy to…".
 *
 * A popover rather than a dropdown menu, because "Copy to…" needs room for a
 * box per day and an Apply: the list of actions turns into the day picker in
 * the same place, and Back returns to it. A dropdown would have to close and
 * open a second surface, and the focus it hands back on closing would shut the
 * second one again.
 */
function DayActions({
  index,
  label,
  allDay,
  complete,
  onAllDay,
  onCopyTo,
}: {
  index: number;
  label: string;
  allDay: boolean;
  complete: boolean;
  onAllDay: (on: boolean) => void;
  onCopyTo: (targets: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [ticked, setTicked] = useState<Set<number>>(() => new Set());
  const days = DISPLAY_ORDER.filter((day) => day !== index);
  const all = days.every((day) => ticked.has(day));
  const some = days.some((day) => ticked.has(day));

  function show(next: boolean) {
    setOpen(next);
    if (!next) {
      setPicking(false);
      setTicked(new Set());
    }
  }

  function tick(day: number, on: boolean) {
    const next = new Set(ticked);
    if (on) next.add(day);
    else next.delete(day);
    setTicked(next);
  }

  const item =
    "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-start text-[13.5px] text-ink outline-none hover:bg-hover focus-visible:bg-hover disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:text-ink-3";

  return (
    <Popover
      open={open}
      onOpenChange={show}
      align="end"
      className={picking ? "w-64" : "w-56 p-1"}
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("hours.dayActions", { day: label })}
        >
          <MoreHorizontal />
        </Button>
      }
    >
      {picking ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPicking(false)}
              aria-label={t("hours.back")}
              className="-ms-1.5"
            >
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
            <p className="text-[13px] font-medium text-ink">
              {t("hours.copyToTitle", { day: label })}
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <Checkbox
              checked={all ? true : some ? "indeterminate" : false}
              onCheckedChange={(on) => setTicked(new Set(on ? days : []))}
              label={t("hours.copyToAllDays")}
            />
            <div className="flex flex-col gap-2.5 border-t border-line pt-2.5">
              {days.map((day) => (
                <Checkbox
                  key={day}
                  checked={ticked.has(day)}
                  onCheckedChange={(on) => tick(day, on)}
                  label={t(DAY_KEYS[day])}
                />
              ))}
            </div>
          </div>
          <p className="text-[12px] text-ink-3">{t("hours.copyToHint")}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => show(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!some}
              onClick={() => {
                onCopyTo([...ticked]);
                show(false);
              }}
            >
              {t("hours.copyToApply")}
            </Button>
          </div>
        </div>
      ) : (
        <div role="group" aria-label={label} className="flex flex-col">
          <button
            type="button"
            className={item}
            onClick={() => {
              onAllDay(!allDay);
              show(false);
            }}
          >
            <Clock />
            {allDay ? t("hours.setHours") : t("hours.allDay")}
          </button>
          <button
            type="button"
            className={item}
            disabled={!complete}
            onClick={() => setPicking(true)}
          >
            <CalendarDays />
            {t("hours.copyTo")}
          </button>
        </div>
      )}
    </Popover>
  );
}

/**
 * The week, read back — and whether it is open right now.
 *
 * "Right now" is the one thing on this screen that can be checked against
 * reality: an operator who knows the shop is serving and reads Closed has
 * caught a mistake, most often an overnight window entered the wrong way
 * round. Beirut's clock, never the machine's, and the zone is named.
 */
export function HoursSummary({
  hours,
  dirty = false,
  children,
}: {
  hours: DayWindow[];
  dirty?: boolean;
  children?: ReactNode;
}) {
  const clock = useClock();
  const now = useNow();
  const describe = useDescribeChange();
  const unset = hours.length === 0;
  const open = openAt(hours, now);
  const spans = summarise(hours, DISPLAY_ORDER);
  const change = nextChangeAt(hours, now);

  return (
    <aside className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 shadow-xs @3xl:sticky @3xl:top-4">
      <div className="flex flex-col gap-1">
        <p className="text-[12px] font-medium text-ink-3">
          {t("hours.rightNow")}
        </p>
        <p
          className={cx(
            "flex items-center gap-2 text-[16px] font-semibold",
            open ? "text-success-ink" : "text-ink-2",
          )}
        >
          <span
            aria-hidden
            className={cx(
              "size-2 rounded-full",
              open ? "bg-success" : "bg-ink-4",
            )}
          />
          {unset
            ? t("hours.openNow")
            : change.at || open
              ? describe(change)
              : t("hours.closedNow")}
        </p>
        <p className="text-[12.5px] text-ink-3 tabular-nums">
          {t("hours.beirutTime", {
            time: clock.time(now),
            zone: businessTimezone(),
          })}
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <p className="text-[12px] font-medium text-ink-3">
          {t("hours.theWeek")}
        </p>
        {unset ? (
          <p className="text-[13px] text-warning-ink">{t("hours.noHours")}</p>
        ) : (
          <dl className="flex flex-col gap-1.5">
            {spans.map((span) => (
              <div
                key={`${span.from}-${span.to}`}
                className="flex items-baseline justify-between gap-3 text-[13px]"
              >
                <dt className="font-medium text-ink">
                  {span.from === span.to
                    ? t(DAY_KEYS[span.from])
                    : t("hours.range", {
                        from: t(DAY_KEYS[span.from]),
                        to: t(DAY_KEYS[span.to]),
                      })}
                </dt>
                <dd
                  className={cx(
                    "text-end",
                    span.open ? "text-ink-2 tabular-nums" : "text-ink-4",
                  )}
                >
                  {span.open
                    ? span.windows.length === 1 && isAllDay(span.windows[0])
                      ? t("hours.allDay")
                      : span.windows
                          .map(
                            (one) =>
                              `${clock.hhmm(one.opensAt)}–${clock.hhmm(one.closesAt)}`,
                          )
                          .join(", ")
                    : t("hours.closed")}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {dirty && (
        <p
          role="status"
          className="rounded-md bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink"
        >
          {t("hours.unsaved")}
        </p>
      )}

      {children}
    </aside>
  );
}
