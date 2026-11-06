"use client";

import { RotateCcw } from "lucide-react";

import { Badge, Button, Switch, cx } from "@/components/ui";
import { nextChangeAt } from "@/features/catalog/shops/next-change";
import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";

import { isOverridden, isTakingOrders, type Courier } from "./api/couriers";
import { DAY_LABELS } from "./hours-grid";
import { useSaveCourier } from "./use-couriers";

/**
 * Whether a driver is taking orders, as a badge — a *state* read from their
 * week (migration 0084), not a setting somebody has to remember twice a day.
 */
export function ShiftBadge({ courier }: { courier: Courier }) {
  if (!courier.isActive) {
    return <Badge tone="neutral">{t("drivers.inactive")}</Badge>;
  }
  const taking = isTakingOrders(courier);
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
 * 23:00" uses, on Beirut's clock. An override says so instead: tonight's
 * state is somebody's decision, and the rota's next change does not end it.
 * A driver with no hours is never offered (unlike a shop with none, which is
 * open around the clock), so that gets its own words.
 */
export function ShiftLine({
  courier,
  className,
}: {
  courier: Courier;
  className?: string;
}) {
  const clock = useClock();
  if (!courier.isActive) return null;

  let text: string;
  let warn = false;
  if (courier.availableOverride !== null) {
    text = t("drivers.overruled");
    warn = true;
  } else if (courier.hours.length === 0) {
    text = t("drivers.noHours");
    warn = true;
  } else {
    const change = nextChangeAt(courier.hours, new Date());
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
 * Tonight's exception to the week.
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
  const taking = isTakingOrders(courier);
  const overridden = isOverridden(courier);

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

  const back = overridden && (
    <button
      type="button"
      disabled={save.isPending}
      onClick={() => override(null)}
      className="font-medium text-accent hover:text-accent-hover hover:underline disabled:opacity-50"
    >
      {t("drivers.followRota")}
    </button>
  );

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
              ? taking
                ? t("drivers.overrideOn")
                : t("drivers.overrideOff")
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

  return (
    <div className="flex flex-col items-end gap-1">
      <Switch
        checked={taking}
        disabled={save.isPending}
        onCheckedChange={(on) => override(on)}
        aria-label={t("drivers.onShift")}
      />
      {overridden && <span className="text-[12px]">{back}</span>}
    </div>
  );
}
