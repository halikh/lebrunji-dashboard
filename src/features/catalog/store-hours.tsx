"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import { Button, cx } from "@/components/ui";
import { Toggle } from "@/components/ui/toggle";
import { useToasts } from "@/components/ui/toast";
import { TimeField } from "@/components/ui/time-field";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { t } from "@/i18n/translations";

import { BUSINESS_TIMEZONE, toWallClock } from "@/lib/time";
import { isOpenAt, summarise, type DayWindow } from "@/lib/week";

import { fetchStoreHours, saveStoreHours, type DayHours } from "./api/hours";

/**
 * A shop's week.
 *
 * ## Why a grid with one Save, and not seven rows in a list
 *
 * The seven days are one answer to one question — *when is this shop open* —
 * and they are almost always set together, once, when the shop is onboarded.
 * Seven separately-saved rows would make the common case seven interactions and
 * would hide the thing an operator is actually checking, which is the **shape**
 * of the week: which days are shut, whether the weekend differs, whether
 * anything looks wrong at a glance.
 *
 * That shape is also why "copy the first open day to the rest" is here. Most
 * shops keep the same hours every day they open, so the honest default is to
 * fill the week once and adjust the exceptions.
 *
 * ## Closed is the absence of a row
 *
 * The switch does not write "closed"; it removes the day. `store_hours` has one
 * row per day a shop opens and the app reads a missing day as shut, so this
 * grid's job is to decide which rows should exist.
 *
 * ## Overnight is normal
 *
 * A kitchen open 18:00–02:00 stores exactly that, with a closing time earlier
 * than its opening one. Nothing here treats that as an error, and the row says
 * so in words rather than leaving the operator wondering whether it took.
 */

/**
 * The days, as stored. `day_of_week` is 0–6 **Sunday first**, matching
 * `Date#getDay` and the reader in the app's `lib/store-hours.ts`.
 */
const WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * The days, as read. **Monday first**, which is how a week is laid out here.
 *
 * Two orders, deliberately, and they are different questions. The stored one is
 * fixed by `Date#getDay` and by every reader of the column — changing it would
 * mean rewriting rows and the app at once, to move a heading. The read one is a
 * presentation decision and belongs to this screen.
 *
 * Keeping them apart is what stops the classic off-by-one: the state below is
 * indexed by the *stored* day throughout, so nothing that reaches the database
 * ever passes through a display position.
 */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const DAY_KEYS = [
  "hours.sunday",
  "hours.monday",
  "hours.tuesday",
  "hours.wednesday",
  "hours.thursday",
  "hours.friday",
  "hours.saturday",
] as const;

type Draft = { open: boolean; opensAt: string; closesAt: string };

export function StoreHours({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  const hours = useQuery({
    queryKey: ["store-hours", storeId],
    queryFn: () => fetchStoreHours(storeId),
  });

  const save = useMutation({
    mutationFn: (week: DayHours[]) => saveStoreHours(storeId, week),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["store-hours", storeId],
      });
      toast.success(t("hours.saved"));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
    onSettled: () => {
      // On failure as well as success, so a half-applied week — which is
      // possible, see `saveStoreHours` — shows what actually landed rather than
      // what was asked for.
      void queryClient.invalidateQueries({
        queryKey: ["store-hours", storeId],
      });
    },
  });

  if (hours.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-sm p-xxl">
        {WEEK.map((day) => (
          <div
            key={day}
            className="h-[52px] rounded-md border border-border bg-surface opacity-60"
          />
        ))}
      </div>
    );
  }

  if (hours.isError) {
    return (
      <div className="flex flex-col items-center gap-lg py-huge text-center">
        <h2 className="text-[18px]">{t("hours.failedTitle")}</h2>
        <Button variant="secondary" onClick={() => void hours.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  return (
    <Grid
      // Keyed on what came back, so a refetch that changes the week rebuilds
      // the form rather than leaving edits sitting on top of newer data.
      key={JSON.stringify(hours.data)}
      saved={hours.data}
      pending={save.isPending}
      onSave={(week) => save.mutate(week)}
    />
  );
}

function Grid({
  saved,
  pending,
  onSave,
}: {
  saved: DayHours[];
  pending: boolean;
  onSave: (week: DayHours[]) => void;
}) {
  const [week, setWeek] = useState<Draft[]>(() =>
    WEEK.map((day) => {
      const row = saved.find((one) => one.dayOfWeek === day);
      return row
        ? { open: true, opensAt: row.opensAt, closesAt: row.closesAt }
        : // A day that has never been set opens with the hours a shop most
          // often keeps, so filling the week is a switch rather than a switch
          // and two pickers.
          { open: false, opensAt: "09:00", closesAt: "22:00" };
    }),
  );

  const [error, setError] = useState<string | null>(null);

  /**
   * Unsaved, so the panel can say so.
   *
   * It reads the *draft*, deliberately — the point is to see what you are about
   * to save before you save it — which means it can disagree with the app until
   * Save is pressed, and has to admit that rather than look authoritative.
   */
  const dirty = JSON.stringify(toWindows(week)) !== JSON.stringify(saved);

  // The panel already says so in words; this is what stops the week being
  // walked away from without reading them.
  useUnsavedChanges(dirty);

  function update(day: number, patch: Partial<Draft>) {
    setWeek((current) =>
      current.map((one, index) => (index === day ? { ...one, ...patch } : one)),
    );
    setError(null);
  }

  /**
   * The first open day **as displayed**, which is normally Monday.
   *
   * "The same as the others" means the same as the first one you can see. Taking
   * it from the stored order would quietly mean Sunday, and the button would
   * offer hours the operator had not looked at.
   */
  const template = DISPLAY_ORDER.map((day) => week[day]).find(
    (day) => day.open,
  );

  function copyDown() {
    if (!template) return;
    setWeek((current) =>
      current.map((day) =>
        day.open
          ? { ...day, opensAt: template.opensAt, closesAt: template.closesAt }
          : day,
      ),
    );
  }

  function submit() {
    const incomplete = week.some(
      (day) => day.open && (!day.opensAt || !day.closesAt),
    );
    if (incomplete) {
      setError(t("hours.incomplete"));
      return;
    }

    onSave(
      week.flatMap((day, index) =>
        day.open
          ? [{ dayOfWeek: index, opensAt: day.opensAt, closesAt: day.closesAt }]
          : [],
      ),
    );
  }

  return (
    // `h-full`, not `flex-1`.
    //
    // `flex-1` only means anything inside a flex container, and the tab wrapper
    // around this is an ordinary block — so the pane grew to fit its content
    // and pushed the Save row off the bottom of the screen, which is the one
    // place it must never be.
    <div className="flex h-full min-h-0 flex-col">
      {/* The grid sets the hours; the panel beside it reads them back.
          Seven rows of switches and pickers is the right shape for *setting* a
          week and the wrong one for *checking* it — "Mon–Fri 11:00–23:00,
          closed Sunday" is the same information in the form a person actually
          holds it in, and it is what catches the day left shut by accident. */}
      <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-lg">
          <div className="flex flex-col gap-sm">
            {DISPLAY_ORDER.map((index) => {
              const day = week[index];
              return (
                <div
                  key={index}
                  className={cx(
                    "flex flex-wrap items-center gap-lg rounded-md border bg-surface px-lg py-md",
                    day.open
                      ? "border-border"
                      : "border-danger-wash bg-danger-wash/30",
                  )}
                >
                  {/* A fixed width, so the switches line up down the week and the
                  shape of it can be read without reading any of the words. */}
                  <span className="w-[104px] shrink-0 text-[15px] font-semibold">
                    {t(DAY_KEYS[index])}
                  </span>

                  <Toggle
                    on={day.open}
                    onChange={() => update(index, { open: !day.open })}
                    labelOn={t("hours.open")}
                    labelOff={t("hours.closed")}
                    className="w-[92px]"
                  />

                  {day.open ? (
                    <div className="flex items-center gap-sm">
                      <TimeField
                        value={day.opensAt}
                        onChange={(value) => update(index, { opensAt: value })}
                      />
                      <span className="text-[14px] text-text-soft">
                        {t("hours.to")}
                      </span>
                      <TimeField
                        value={day.closesAt}
                        onChange={(value) => update(index, { closesAt: value })}
                      />

                      {/* Said out loud, because a closing time earlier than an
                      opening one looks like a mistake and is not — a kitchen
                      open until two in the morning is ordinary, and without
                      this the operator would "fix" it. */}
                      {crossesMidnight(day) && (
                        <span className="text-[12px] text-text-faint">
                          {t("hours.overnight")}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[13px] text-text-faint">
                      {t("hours.closedAllDay")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {error}
            </p>
          )}
        </div>

        <Summary week={week} dirty={dirty}>
          {/* Beside the week it rewrites, not under the grid it reads from.
              The summary is where an operator *notices* that six days should
              match Monday — that is the whole reason the panel exists — so the
              control that acts on the noticing belongs next to it. */}
          {template && (
            // Blue, which the palette reserves for what you act on. Grey read
            // as one more line of the summary it sits under — and this is the
            // only thing in that panel that does anything.
            <Button
              variant="primary-quiet"
              size="sm"
              onClick={copyDown}
              fullWidth
            >
              {t("hours.copyToAll", {
                opens: template.opensAt,
                closes: template.closesAt,
              })}
            </Button>
          )}
        </Summary>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button onClick={submit} pending={pending}>
          {t("hours.save")}
        </Button>
      </div>
    </div>
  );
}

function crossesMidnight(day: Draft): boolean {
  return (
    day.opensAt !== "" && day.closesAt !== "" && day.closesAt <= day.opensAt
  );
}

/** The draft, in the shape the readers in `lib/week.ts` take. */
function toWindows(week: Draft[]): DayWindow[] {
  return week.flatMap((day, index) =>
    day.open && day.opensAt && day.closesAt
      ? [{ dayOfWeek: index, opensAt: day.opensAt, closesAt: day.closesAt }]
      : [],
  );
}

/**
 * The week, read back.
 *
 * ## Why "open now" is here at all
 *
 * It is the one thing on this screen that can be checked against reality. An
 * operator setting hours at half past eleven on a Tuesday knows whether the
 * shop is serving, and a panel that disagrees has just caught a mistake — most
 * often an overnight window entered the wrong way round, which looks entirely
 * correct in the grid.
 *
 * **Beirut's clock, not the machine's.** The whole point is what the shop is
 * doing, and an operator on a laptop still set to another zone would otherwise
 * be told about a different hour of a different day.
 */
function Summary({
  week,
  dirty,
  children,
}: {
  week: Draft[];
  dirty: boolean;
  /** Rendered under "Right now" — see the call site. */
  children?: ReactNode;
}) {
  const windows = toWindows(week);
  const now = toWallClock(new Date());

  // The weekday of the Beirut calendar date. Built as UTC so that reading it
  // back with `getUTCDay` cannot pick up the machine's own offset.
  const weekday = new Date(
    Date.UTC(now.year, now.month - 1, now.day),
  ).getUTCDay();

  const time = `${String(now.hour).padStart(2, "0")}:${String(
    now.minute,
  ).padStart(2, "0")}`;

  const open = isOpenAt(windows, weekday, time);
  const spans = summarise(windows, DISPLAY_ORDER);

  return (
    <aside className="flex w-full flex-col gap-lg rounded-md border border-border bg-surface p-lg lg:w-[300px] lg:shrink-0">
      <div className="flex flex-col gap-xs">
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
          {t("hours.rightNow")}
        </span>
        <span
          className="flex items-center gap-sm text-[17px] font-semibold"
          style={{
            color: open ? "var(--color-accent)" : "var(--color-text-soft)",
          }}
        >
          <span
            aria-hidden
            className="size-[10px] shrink-0 rounded-full"
            style={{
              background: open
                ? "var(--color-accent)"
                : "var(--color-neutral-fill)",
            }}
          />
          {open ? t("hours.openNow") : t("hours.closedNow")}
        </span>
        {/* The zone is named. Otherwise a time on screen is only ever an
            assertion about whose clock it came from. */}
        <span className="text-[12px] text-text-faint">
          {t("hours.beirutTime", { time, zone: BUSINESS_TIMEZONE })}
        </span>

        {children}
      </div>

      <div className="flex flex-col gap-xs border-t border-border pt-lg">
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
          {t("hours.theWeek")}
        </span>
        <ul className="flex flex-col gap-xxs">
          {spans.map((span) => (
            <li
              key={`${span.from}-${span.to}`}
              className="flex items-baseline justify-between gap-md text-[14px]"
            >
              <span className="font-semibold">
                {span.from === span.to
                  ? t(DAY_KEYS[span.from])
                  : t("hours.range", {
                      from: t(DAY_KEYS[span.from]),
                      to: t(DAY_KEYS[span.to]),
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
                  ? `${span.opensAt}–${span.closesAt}`
                  : t("hours.closed")}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {dirty && (
        <p
          role="status"
          className="rounded-md bg-yellow-wash px-md py-sm text-[12px] text-text"
        >
          {t("hours.unsaved")}
        </p>
      )}
    </aside>
  );
}
