"use client";

import { Toggle } from "@/components/ui/toggle";
import { TimeField } from "@/components/ui/time-field";
import { cx } from "@/components/ui";
import { useClock } from "@/features/settings/use-clock";
import { t, type TranslationKey } from "@/i18n/translations";
import { BUSINESS_TIMEZONE } from "@/lib/time";
import { isOpenNow, summarise } from "@/lib/week";
import type { DayHours } from "@/features/catalog/api/hours";

/**
 * A driver's week.
 *
 * ## The same grid a shop gets, and deliberately so
 *
 * Seven rows, Monday first, a switch per day and two pickers behind it. The
 * shop's version made every one of these decisions already and each was argued
 * for there: **closed is the absence of a row**, because that is what the
 * reader expects; **overnight is normal and is labelled rather than
 * corrected**, because a driver working 18:00–02:00 stores a closing time
 * earlier than its opening one and that looks like a bug; **the stored day
 * index stays 0–6 Sunday-first** while the display starts on Monday, so the
 * two orders are kept apart and nothing reaching the database passes through a
 * display position.
 *
 * Repeating them is what makes the two screens one thing to learn. What is
 * *not* repeated is the fetching and saving — this takes a week and hands one
 * back, so the wizard can hold an unsaved draft and the profile can save on
 * demand without either owning the layout.
 *
 * ## The summary is the part that catches mistakes
 *
 * Seven rows of pickers is the right shape for *setting* a week and the wrong
 * one for *checking* it. "Mon–Sat 16:00–23:00, off Sunday" is one line somebody
 * can compare against what the driver actually told them — and it is what
 * catches an overnight window entered the wrong way round, which the grid shows
 * as two perfectly plausible times.
 */

/** Monday first for reading. The stored index is untouched — see above. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Keyed by the **stored** index, so nothing here depends on display order. */
const DAY_LABELS: Record<number, TranslationKey> = {
  0: "hours.sunday",
  1: "hours.monday",
  2: "hours.tuesday",
  3: "hours.wednesday",
  4: "hours.thursday",
  5: "hours.friday",
  6: "hours.saturday",
};

export function HoursGrid({
  week,
  onChange,
}: {
  week: DayHours[];
  onChange: (next: DayHours[]) => void;
}) {
  const clock = useClock();
  const dayOf = (index: number) =>
    week.find((one) => one.dayOfWeek === index) ?? null;

  function setDay(index: number, patch: Partial<DayHours> | null) {
    if (patch === null) {
      onChange(week.filter((one) => one.dayOfWeek !== index));
      return;
    }

    const existing = dayOf(index);
    const next = existing
      ? week.map((one) =>
          one.dayOfWeek === index ? { ...one, ...patch } : one,
        )
      : [
          ...week,
          { dayOfWeek: index, opensAt: "16:00", closesAt: "23:00", ...patch },
        ];

    onChange(next.sort((a, b) => a.dayOfWeek - b.dayOfWeek));
  }

  /**
   * Copies the first working day across every other working day.
   *
   * The common case by a distance: a driver works the same hours every day they
   * work at all, and setting that six times is six chances to fat-finger one of
   * them into a shift nobody notices for a week.
   */
  function applyToAll() {
    const first = week.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek)[0];
    if (!first) return;
    onChange(
      week.map((one) => ({
        ...one,
        opensAt: first.opensAt,
        closesAt: first.closesAt,
      })),
    );
  }

  const spans = summarise(week, DISPLAY_ORDER);
  const onShift = isOpenNow(week);
  const first = week.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek)[0];

  return (
    <div className="flex flex-col gap-lg">
      {/* Read back before it is edited. What somebody checks is the *shape* of
          the week — which days are off, whether the weekend differs — and
          seven separate rows hide exactly that. */}
      <div className="flex flex-col gap-xs rounded-lg border border-border bg-neutral-fill/40 p-lg">
        <div className="flex flex-wrap items-center gap-sm">
          <span className="text-[13px] font-semibold">
            {t("hours.rightNow")}
          </span>
          <span
            className={cx(
              "rounded-sm px-sm py-[1px] text-[11px] font-semibold",
              onShift
                ? "bg-accent-wash text-text"
                : "bg-neutral-fill text-text-faint",
            )}
          >
            {onShift ? t("drivers.onShift") : t("drivers.offShift")}
          </span>
          <span className="text-[11px] text-text-faint">
            {t("promotions.inZone", { zone: BUSINESS_TIMEZONE })}
          </span>
        </div>

        {week.length === 0 ? (
          <p className="text-[13px] text-text-soft">{t("drivers.noWeek")}</p>
        ) : (
          <ul className="flex flex-col gap-xxs">
            {spans.map((span) => (
              <li
                key={`${span.from}-${span.to}`}
                className="flex items-baseline justify-between gap-md text-[14px]"
              >
                <span className="font-semibold">
                  {span.from === span.to
                    ? t(DAY_LABELS[span.from])
                    : t("hours.range", {
                        from: t(DAY_LABELS[span.from]),
                        to: t(DAY_LABELS[span.to]),
                      })}
                </span>
                <span
                  className={
                    span.open
                      ? "tabular-nums text-text-soft"
                      : "text-[13px] text-text-faint"
                  }
                >
                  {span.open
                    ? `${clock.hhmm(span.opensAt)}–${clock.hhmm(span.closesAt)}`
                    : t("hours.closed")}
                </span>
              </li>
            ))}
          </ul>
        )}

        {first && week.length > 1 && (
          <button
            type="button"
            onClick={applyToAll}
            className="w-fit text-[13px] font-semibold text-primary hover:underline"
          >
            {t("hours.copyToAll", {
              opens: first.opensAt,
              closes: first.closesAt,
            })}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-sm">
        {DISPLAY_ORDER.map((index) => {
          const day = dayOf(index);
          const overnight =
            day !== null && day.closesAt <= day.opensAt && day.closesAt !== "";

          return (
            <div
              key={index}
              className="flex flex-wrap items-center gap-lg rounded-md border border-border bg-surface px-lg py-md"
            >
              <span className="w-[92px] shrink-0 text-[14px] font-semibold">
                {t(DAY_LABELS[index])}
              </span>

              <Toggle
                on={day !== null}
                onChange={() => setDay(index, day ? null : {})}
                labelOn={t("drivers.working")}
                labelOff={t("drivers.dayOff")}
                className="w-[104px]"
              />

              {day && (
                <div className="flex flex-wrap items-center gap-sm">
                  <TimeField
                    value={day.opensAt}
                    onChange={(value) => setDay(index, { opensAt: value })}
                  />
                  <span className="text-[14px] text-text-soft">
                    {t("hours.to")}
                  </span>
                  <TimeField
                    value={day.closesAt}
                    onChange={(value) => setDay(index, { closesAt: value })}
                  />

                  {/* Said out loud, because a closing time earlier than an
                      opening one looks like a mistake and usually is not — it
                      is a shift that runs past midnight. Correcting it would
                      delete the late shift, which is the one that matters. */}
                  {overnight && (
                    <span className="text-[12px] font-semibold text-active-ink">
                      {t("hours.overnight")}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
