"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { Toggle } from "@/components/ui/toggle";
import { useToasts } from "@/components/ui/toast";
import { TimeField } from "@/components/ui/time-field";
import { t } from "@/i18n/translations";

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

const WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

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

  function update(day: number, patch: Partial<Draft>) {
    setWeek((current) =>
      current.map((one, index) => (index === day ? { ...one, ...patch } : one)),
    );
    setError(null);
  }

  /** The first day that is open, which is what "the same as the others" means. */
  const template = week.find((day) => day.open);

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
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        <div className="flex max-w-[720px] flex-col gap-sm">
          {week.map((day, index) => (
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
          ))}
        </div>

        {template && (
          <Button
            variant="secondary"
            size="sm"
            onClick={copyDown}
            className="w-fit"
          >
            {t("hours.copyToAll", {
              opens: template.opensAt,
              closes: template.closesAt,
            })}
          </Button>
        )}

        {error && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
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
