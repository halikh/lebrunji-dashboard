"use client";

import { AlertTriangle, CopyCheck, Moon } from "lucide-react";

import { Badge, Button, Switch, cx } from "@/components/ui";
import { TimeField } from "@/components/ui/time-field";
import type { DayHours } from "@/features/catalog/api/hours";
import { useClock } from "@/features/settings/use-clock";
import { t, type TranslationKey } from "@/i18n/translations";
import { businessTimezone } from "@/lib/time";
import {
  clipToOurHours,
  daysOutsideOurHours,
  isOpenNow,
  summarise,
  withinOurHours,
} from "@/lib/week";

import { useOurHours } from "./use-couriers";

/**
 * A driver's week.
 *
 * The same decisions the shop's hours make, kept so the two read as one thing
 * to learn: **a day off is the absence of a row**; **overnight is normal** and
 * is labelled rather than corrected (18:00–02:00 stores a closing time earlier
 * than its opening one); **the stored day index stays 0–6 Sunday-first** while
 * the display starts on Monday, so nothing reaching the database passes through
 * a display position.
 *
 * The grid only takes a week and hands one back: the editor page holds it as an
 * unsaved draft, the profile's sheet saves it on demand.
 */

/** Monday first for reading. The stored index is untouched — see above. */
export const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Keyed by the **stored** index, so nothing here depends on display order. */
export const DAY_LABELS: Record<number, TranslationKey> = {
  0: "hours.sunday",
  1: "hours.monday",
  2: "hours.tuesday",
  3: "hours.wednesday",
  4: "hours.thursday",
  5: "hours.friday",
  6: "hours.saturday",
};

/**
 * The week a new driver starts on.
 *
 * A driver with no working days is never on shift, so a blank default creates
 * somebody who can never be dispatched. Monday to Saturday, late afternoon into
 * the night; Sunday is left off rather than guessed at, because a default wrong
 * in the *absence* direction is corrected the first time somebody looks.
 */
export const DEFAULT_WEEK: DayHours[] = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  opensAt: "16:00",
  closesAt: "23:00",
}));

export function HoursGrid({
  week,
  onChange,
  disabled,
}: {
  week: DayHours[];
  onChange: (next: DayHours[]) => void;
  disabled?: boolean;
}) {
  const clock = useClock();
  const ours = useOurHours();
  // Time down on a day that we are closed for is time they cannot work: they
  // are offered only inside our hours (0280). Said on the day, not refused,
  // so a week can still be saved while our hours are being changed.
  const outside = new Set(ours ? daysOutsideOurHours(week, ours) : []);
  const dayOf = (index: number) =>
    week.find((one) => one.dayOfWeek === index) ?? null;

  function setDay(index: number, patch: Partial<DayHours> | null) {
    if (patch === null) {
      onChange(week.filter((one) => one.dayOfWeek !== index));
      return;
    }
    const existing = dayOf(index);
    // A day switched back on takes the hours of the first working day, so a
    // driver with one set of hours is not typed in seven times.
    const template = week
      .slice()
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)[0] ?? {
      opensAt: "16:00",
      closesAt: "23:00",
    };
    const next = existing
      ? week.map((one) =>
          one.dayOfWeek === index ? { ...one, ...patch } : one,
        )
      : [
          ...week,
          {
            dayOfWeek: index,
            opensAt: template.opensAt,
            closesAt: template.closesAt,
            ...patch,
          },
        ];
    onChange(next.sort((a, b) => a.dayOfWeek - b.dayOfWeek));
  }

  return (
    <ul className="-my-2 divide-y divide-line">
      {DISPLAY_ORDER.map((index) => {
        const day = dayOf(index);
        const dayName = t(DAY_LABELS[index]);
        const overnight =
          day !== null && day.closesAt !== "" && day.closesAt <= day.opensAt;

        return (
          <li
            key={index}
            className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 py-2"
          >
            <div className="flex w-full items-center justify-between gap-3 sm:w-48 sm:justify-start">
              <span
                className={cx(
                  "w-24 text-[14px] font-medium",
                  day ? "text-ink" : "text-ink-3",
                )}
              >
                {dayName}
              </span>
              <span className="flex items-center gap-2">
                <Switch
                  checked={day !== null}
                  disabled={disabled}
                  onCheckedChange={(on) => setDay(index, on ? {} : null)}
                  aria-label={dayName}
                />
                <span className="w-16 text-[13px] text-ink-3">
                  {day ? t("drivers.working") : t("drivers.dayOff")}
                </span>
              </span>
            </div>

            {day && (
              <div className="flex flex-wrap items-center gap-2">
                <TimeField
                  value={day.opensAt}
                  disabled={disabled}
                  aria-label={t("drivers.timeLabel", {
                    day: dayName,
                    which: t("general.opensAt"),
                  })}
                  onChange={(value: string) =>
                    setDay(index, { opensAt: value })
                  }
                />
                <span className="text-[13px] text-ink-3">{t("hours.to")}</span>
                <TimeField
                  value={day.closesAt}
                  disabled={disabled}
                  aria-label={t("drivers.timeLabel", {
                    day: dayName,
                    which: t("general.closesAt"),
                  })}
                  onChange={(value: string) =>
                    setDay(index, { closesAt: value })
                  }
                />
                {/* Said out loud: a closing time earlier than the opening one
                    looks like a mistake and is usually a shift past midnight.
                    Correcting it would delete the late shift. */}
                {overnight && (
                  <Badge tone="info">
                    <Moon className="size-3" />
                    {t("hours.overnight")}
                  </Badge>
                )}
                {ours && outside.has(index) && (
                  <Badge tone="warning">
                    <AlertTriangle className="size-3" />
                    {t("drivers.pastOurHours", {
                      open: clock.hour(ours.openHour),
                      close: clock.hour(ours.closeHour),
                    })}
                  </Badge>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The week read back — on shift right now, the timetable in a few lines, and
 * what it adds up to.
 *
 * Seven rows of pickers is the right shape for *setting* a week and the wrong
 * one for *checking* it. "Mon–Sat 16:00–23:00, Sunday off" is one line somebody
 * can compare with what the driver told them, and a total of four hours or of
 * seventy is wrong in a way the rows do not show.
 *
 * `onChange`, when given, offers "apply to all open days" — a change to the
 * whole week, so it sits with the view of the whole week.
 */
export function WeekSummary({
  week,
  onChange,
  showNow = true,
}: {
  week: DayHours[];
  onChange?: (next: DayHours[]) => void;
  showNow?: boolean;
}) {
  const clock = useClock();
  const ours = useOurHours();
  const sorted = week.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const first = sorted[0];
  const spans = summarise(week, DISPLAY_ORDER);
  // Their hours as far as they reach inside ours (0280) — the switch on the
  // profile can still overrule this for tonight.
  const onShift = ours
    ? withinOurHours(ours) && isOpenNow(clipToOurHours(week, ours))
    : isOpenNow(week);
  const uniform =
    !!first &&
    week.every(
      (one) => one.opensAt === first.opensAt && one.closesAt === first.closesAt,
    );

  return (
    <div className="flex flex-col gap-4">
      {showNow && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-ink">
            {t("hours.rightNow")}
          </span>
          <Badge tone={onShift ? "success" : "neutral"} dot>
            {onShift ? t("drivers.onShift") : t("drivers.offShift")}
          </Badge>
          <span className="text-[12px] text-ink-4">
            {t("promotions.inZone", { zone: businessTimezone() })}
          </span>
        </div>
      )}

      {week.length === 0 ? (
        <p className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning-soft px-3 py-2.5 text-[13px] text-warning-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t("drivers.noWeek")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-subtle">
          {spans.map((span) => (
            <li
              key={`${span.from}-${span.to}`}
              className="flex items-baseline justify-between gap-3 px-3 py-2 text-[13.5px]"
            >
              <span className="font-medium text-ink">
                {span.from === span.to
                  ? t(DAY_LABELS[span.from])
                  : t("hours.range", {
                      from: t(DAY_LABELS[span.from]),
                      to: t(DAY_LABELS[span.to]),
                    })}
              </span>
              <span
                className={
                  span.open ? "text-end text-ink-2 tabular-nums" : "text-ink-4"
                }
              >
                {span.open
                  ? span.windows
                      .map(
                        (w) =>
                          `${clock.hhmm(w.opensAt)}–${clock.hhmm(w.closesAt)}`,
                      )
                      .join(", ")
                  : t("hours.closed")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {week.length > 0 && (
        <p className="text-[13px] text-ink-3 tabular-nums">
          {t("drivers.weekTotals", {
            days: week.length,
            hours: formatHours(totalMinutes(week)),
          })}
        </p>
      )}

      {onChange && first && week.length > 1 && !uniform && (
        <Button
          variant="secondary"
          size="sm"
          className="w-fit"
          onClick={() =>
            onChange(
              week.map((one) => ({
                ...one,
                opensAt: first.opensAt,
                closesAt: first.closesAt,
              })),
            )
          }
        >
          <CopyCheck />
          {t("hours.copyToAll")}
        </Button>
      )}
    </div>
  );
}

/**
 * Minutes worked across the week. A closing time at or before the opening one
 * runs past midnight — the rule `isOpenAt` follows — so 18:00–02:00 is eight
 * hours, not minus sixteen. An unreadable time counts as nothing.
 */
function totalMinutes(week: DayHours[]): number {
  return week.reduce((sum, day) => {
    const opens = toMinutes(day.opensAt);
    const closes = toMinutes(day.closesAt);
    if (opens === null || closes === null) return sum;
    return sum + (closes > opens ? closes - opens : closes + 24 * 60 - opens);
  }, 0);
}

function toMinutes(time: string): number | null {
  const parts = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  return parts ? Number(parts[1]) * 60 + Number(parts[2]) : null;
}

/** "42" or "42.5" — hours, to the half hour a rota is actually set in. */
function formatHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 2) / 2;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}
