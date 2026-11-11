"use client";

import { RotateCcw } from "lucide-react";

import { Badge, Button, Switch, Tooltip, cx } from "@/components/ui";
import { nextChangeAt } from "@/features/catalog/shops/next-change";
import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";

import { clipToOurHours } from "@/lib/week";

import {
  isOverridden,
  isTakingOrders,
  liveOverride,
  type Courier,
} from "./api/couriers";
import { DAY_LABELS } from "./hours-grid";
import { useOurHours, useSaveCourier } from "./use-couriers";

/**
 * Whether a driver is taking orders, as a badge — a *state* read from their
 * week (migration 0084), not a setting somebody has to remember twice a day.
 */
export function ShiftBadge({ courier }: { courier: Courier }) {
  const ours = useOurHours();
  if (!courier.isActive) {
    return <Badge tone="neutral">{t("drivers.inactive")}</Badge>;
  }
  const taking = isTakingOrders(courier, ours);
  return (
    <Badge tone={taking ? "success" : "neutral"} dot>
      {taking ? t("drivers.onShift") : t("drivers.offShift")}
    </Badge>
  );
}

/**
 * How long the badge stays true — "Until 23:00", "Next shift Fri 18:00" — the
 * line Onfleet and Tookan put under a worker's name, because a dispatcher
 * planning the next hour needs to know who is about to go off, not only who
 * is on.
 *
 * Read from the rota with `nextChangeAt`, the same reading the shops' "closes
 * 23:00" uses, on Beirut's clock, and read from the week **cut to our
 * hours** (0280): a shift down as 16:00–02:00 says "Until 00:00" when we close
 * at midnight, because that is when they stop. A week wholly outside our
 * hours, and one with no hours at all, are never offered, so each gets its
 * own words.
 *
 * A switch says so instead, with when it ends: somebody decided tonight's
 * state, and it lasts until our hours next turn, not until their rota does.
 */
export function ShiftLine({
  courier,
  className,
}: {
  courier: Courier;
  className?: string;
}) {
  const clock = useClock();
  const ours = useOurHours();
  if (!courier.isActive) return null;

  const now = new Date();
  const week = ours ? clipToOurHours(courier.hours, ours) : courier.hours;
  let text: string;
  let warn = false;
  if (liveOverride(courier, now) !== null) {
    text = courier.availableOverrideUntil
      ? t("drivers.overruledUntil", {
          time: clock.time(courier.availableOverrideUntil),
        })
      : t("drivers.overruled");
    warn = true;
  } else if (courier.hours.length === 0) {
    text = t("drivers.noHours");
    warn = true;
  } else if (week.length === 0) {
    text = t("drivers.outsideOurHours");
    warn = true;
  } else {
    const change = nextChangeAt(week, now);
    if (!change.at) return null;
    const time = clock.hhmm(change.at.time);
    text = change.open
      ? t("drivers.onUntil", { time })
      : change.at.daysAhead === 0
        ? t("drivers.nextShiftToday", { time })
        : t("drivers.nextShift", {
            day: t(DAY_LABELS[change.at.dayOfWeek]),
            time,
          });
  }

  return (
    <span
      className={cx(
        "text-[12.5px] tabular-nums",
        warn ? "text-warning-ink" : "text-ink-3",
        className,
      )}
    >
      {text}
    </span>
  );
}

/**
 * Tonight's exception to the week — until our hours next turn (0280): closing
 * if it was set while we are open, opening if it was set while we are closed.
 * The database stamps that end, so the switch cannot outlive the night.
 *
 * The switch shows the *effective* state, and flipping it writes an override
 * rather than editing the week — editing the week to describe one evening is
 * what would quietly become permanent. An override is invisible from outside,
 * so the line under it says which way the week is being overruled and offers
 * to stop: an override left behind is the failure the rota was meant to end.
 */
export function AvailabilityControl({
  courier,
  layout = "row",
}: {
  courier: Courier;
  layout?: "row" | "card";
}) {
  const save = useSaveCourier();
  const clock = useClock();
  const ours = useOurHours();
  const taking = isTakingOrders(courier, ours);
  const overridden = isOverridden(courier);
  const until = courier.availableOverrideUntil;

  function override(value: boolean | null) {
    save.mutate({
      id: courier.id,
      draft: {
        name: courier.name,
        phone: courier.phone,
        availableOverride: value,
      },
      name: courier.name,
    });
  }

  if (layout === "card") {
    return (
      <div className="flex flex-col gap-3">
        <Switch
          checked={taking}
          disabled={save.isPending}
          onCheckedChange={(on) => override(on)}
          label={taking ? t("drivers.onShift") : t("drivers.offShift")}
          description={
            overridden
              ? until
                ? t(
                    taking
                      ? "drivers.overrideOnUntil"
                      : "drivers.overrideOffUntil",
                    {
                      time: clock.time(until),
                    },
                  )
                : t(taking ? "drivers.overrideOn" : "drivers.overrideOff")
              : t("drivers.rotaNote")
          }
        />
        {overridden && (
          <Button
            variant="secondary"
            size="sm"
            className="w-fit"
            pending={save.isPending}
            onClick={() => override(null)}
          >
            <RotateCcw />
            {t("drivers.followRota")}
          </Button>
        )}
      </div>
    );
  }

  // In a row, the way back is an icon in a slot every row keeps, filled or
  // not. As a text link stacked under the switch it made overridden rows
  // wider and taller than the rest, so the badges, the switches and the
  // buttons beside them stopped lining up down the list (user, 2026-11-07).
  // The words are not lost: the line under the name says "Overruled until
  // 00:00", and the button's tooltip and name say what it does.
  return (
    <div className="flex items-center gap-1">
      <Switch
        checked={taking}
        disabled={save.isPending}
        onCheckedChange={(on) => override(on)}
        aria-label={t("drivers.onShift")}
      />
      {overridden ? (
        <Tooltip content={t("drivers.followRota")}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("drivers.followRota")}
            disabled={save.isPending}
            onClick={() => override(null)}
            className="text-accent hover:text-accent-hover"
          >
            <RotateCcw />
          </Button>
        </Tooltip>
      ) : (
        <span aria-hidden className="size-8 shrink-0" />
      )}
    </div>
  );
}
