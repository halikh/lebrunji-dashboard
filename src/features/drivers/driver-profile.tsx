"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { Copyable } from "@/components/ui/copyable";
import { Panel } from "@/components/ui/panel";
import { PanelHeader } from "@/components/ui/panel-header";
import { ROW } from "@/components/ui/row";
import { Toggle } from "@/components/ui/toggle";
import { t } from "@/i18n/translations";
import { Price } from "@/features/reference/price";
import { statusTone } from "@/lib/order-status";
import { formatPhone } from "@/lib/phone";
import {
  formatDayAndTime,
  startOfBusinessDay,
  startOfBusinessDayPlus,
} from "@/lib/time";

import { isOverridden, isTakingOrders, type Courier } from "./api/couriers";
import { DriverEditor } from "./drivers-screen";
import { useCourier, useDispatches, useSaveCourier } from "./use-couriers";

/**
 * One driver, and what they have been given.
 *
 * ## A page, not a panel
 *
 * Same reasoning as the customer profile: a panel is the right shape for a form
 * beside a list and the wrong shape for a record. This carries a history that
 * grows and a rota seven rows tall, and squeezing either into 420px would make
 * the part somebody came to read the smallest thing on the screen.
 *
 ## One page, and the rota is not on it
 *
 * The week briefly had a tab here. It is edited in the same side form as the
 * name and the number — one week editor rather than two that drift — and a tab
 * carrying a second copy was a second place for a rota to be half-saved.
 *
 * What stays is the state the rota *produces*: the switch under the name says
 * whether they are taking orders now, which is the question this page is opened
 * to answer.
 *
 * ## What the history actually claims
 *
 * Every row says the operator **opened a chat** about that order with this
 * driver. Not that the message was sent, that it was read, or that the food
 * arrived — WhatsApp tells the dashboard nothing back. The caveat is on screen
 * rather than only in this comment, because the screen is what somebody reads
 * while working out who had an order that went missing.
 */

export function DriverProfile({ id }: { id: string }) {
  const courier = useCourier(id);
  const dispatches = useDispatches(id);
  const save = useSaveCourier();

  const [editing, setEditing] = useState(false);

  const rows = dispatches.data ?? [];

  // Narrowed once, so the closures below do not each have to re-prove that a
  // query's `data` is still there: it is `Courier | null | undefined` and
  // TypeScript cannot follow that into a callback.
  const driver = courier.data ?? null;

  if (courier.isSuccess && !driver) {
    return (
      <div className="flex h-full flex-col gap-lg p-xxl">
        <Back />
        <p className="text-[15px] text-text-soft">{t("drivers.notFound")}</p>
      </div>
    );
  }

  /**
   * Four figures, and two of them are averages on purpose.
   *
   * Counts answer "what has happened", which is what somebody checking on
   * tonight wants. Averages answer "is this normal", which is the question a
   * count cannot: seven hand-overs today means nothing until you know whether
   * the usual is three or thirty.
   *
   * Both windows are **trading days**, not calendar ones — `startOfBusinessDay`
   * cuts at 08:00 — so a hand-over at half past midnight counts towards the
   * evening it belonged to rather than resetting "today" while the kitchen is
   * still cooking.
   */
  const dayStart = startOfBusinessDay().getTime();
  const weekStart = startOfBusinessDayPlus(-6).getTime();

  const today = rows.filter(
    (one) => new Date(one.dispatchedAt).getTime() >= dayStart,
  ).length;
  const thisWeek = rows.filter(
    (one) => new Date(one.dispatchedAt).getTime() >= weekStart,
  ).length;

  /**
   * The averages, over the days this driver has actually been on the books.
   *
   * Dividing by a fixed 7 or 30 would punish somebody who started on Tuesday:
   * their first week reads as a fraction of what they really did. The span runs
   * from their **earliest hand-over** to today, which is the only window the
   * dashboard can honestly claim to know about — `couriers` records no start
   * date, and inventing one from `created_at` would count the days between
   * being added to the system and first being given an order.
   *
   * At least one day, so a driver on their first evening divides by one rather
   * than by zero.
   */
  const earliest = rows.length
    ? Math.min(
        ...rows.map((one) =>
          startOfBusinessDay(new Date(one.dispatchedAt)).getTime(),
        ),
      )
    : dayStart;
  const daysActive = Math.max(
    1,
    Math.round((dayStart - earliest) / 86_400_000) + 1,
  );
  const perDay = rows.length / daysActive;
  const perWeek = perDay * 7;

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        <div className="flex shrink-0 flex-col gap-lg border-b border-border bg-surface px-xxl py-lg">
          <Back />

          {driver && (
            <div className="flex flex-wrap items-center gap-lg">
              <Avatar id={driver.id} name={driver.name} size={48} />

              <div className="flex min-w-0 flex-grow flex-col gap-xxs">
                <h1 className="truncate text-[24px]">{driver.name}</h1>
                {/* Copy, not dial. This number's job is to be pasted into
                    WhatsApp, and a `tel:` link on a desktop hands it to
                    whatever the machine thinks handles calls — usually
                    nothing, sometimes something nobody wanted opened. */}
                <Copyable
                  value={formatPhone(driver.phone)}
                  label={t("drivers.copyPhone")}
                  className="text-[13px] tabular-nums"
                />
                <Availability
                  courier={driver}
                  pending={save.isPending}
                  onOverride={(value) =>
                    save.mutate({
                      id: driver.id,
                      draft: {
                        name: driver.name,
                        phone: driver.phone,
                        availableOverride: value,
                      },
                      name: driver.name,
                    })
                  }
                />
              </div>

              {/* Coral, not the quiet outline. On the list this is one of three
                  controls on a row and should not shout; here it is the only
                  thing on the page you can *do*, and a secondary button beside
                  nothing else reads as disabled. */}
              <Button onClick={() => setEditing(true)}>
                {t("drivers.edit")}
              </Button>
            </div>
          )}
        </div>

        {/* Outside the header, so the white surface stops at the rule and the
            page's own ground carries the content — the same separation every
            other screen has between the bar that identifies a record and the
            record itself. */}
        <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
          <div className="flex flex-wrap gap-lg">
            <Stat label={t("drivers.statToday")} value={String(today)} />
            <Stat label={t("drivers.statThisWeek")} value={String(thisWeek)} />
            <Stat
              label={t("drivers.statPerDay")}
              value={average(perDay)}
              note={t("drivers.overDays", { count: daysActive })}
            />
            <Stat label={t("drivers.statPerWeek")} value={average(perWeek)} />
            <Stat label={t("drivers.statTotal")} value={String(rows.length)} />
          </div>

          {/* Nothing handed over yet means no section at all. A heading, a
              caveat about what the rows mean, and a line saying there are no
              rows is three pieces of furniture around an absence — and the
              caveat explains a distinction that has not come up yet. */}
          {rows.length > 0 && (
            <section className="flex flex-col gap-sm">
              <h2 className="text-[17px]">{t("drivers.profileHandovers")}</h2>
              <p className="pb-sm text-[12px] text-text-faint">
                {t("drivers.profileCaveat")}
              </p>

              {dispatches.isError && (
                <p role="alert" className="text-[13px] font-medium text-danger">
                  {t("content.failed")}
                </p>
              )}

              {rows.map((row) => {
                const tone = statusTone(row.statusSlug);

                return (
                  <div key={row.id} className={cx(ROW, "border-border")}>
                    <div className="flex min-w-0 flex-grow flex-col gap-xxs">
                      <Link
                        href={`/orders/${row.orderId}`}
                        className="truncate text-[15px] font-semibold after:absolute after:inset-0"
                      >
                        {row.orderCode}
                      </Link>
                      <span className="truncate text-[12px] text-text-faint">
                        {t("drivers.handedAt", {
                          when: formatDayAndTime(row.dispatchedAt),
                        })}
                      </span>
                    </div>

                    <span
                      className="relative z-10 flex shrink-0 items-center gap-sm text-[12px] font-semibold"
                      style={{ color: tone.ink }}
                    >
                      <span
                        aria-hidden
                        className="size-[7px] shrink-0 rounded-full"
                        style={{ background: tone.dot }}
                      />
                      {row.statusName}
                    </span>

                    <span className="relative z-10 shrink-0">
                      <Price
                        value={row.orderTotal}
                        code={row.currencyCode}
                        align="end"
                      />
                    </span>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </div>

      <Panel
        open={editing}
        onClose={() => setEditing(false)}
        label={t("drivers.edit")}
      >
        {editing && driver && (
          <>
            <PanelHeader
              title={driver.name}
              onClose={() => setEditing(false)}
            />
            <DriverEditor
              key={driver.id}
              initial={driver}
              pending={save.isPending}
              onCancel={() => setEditing(false)}
              onSave={(patch) =>
                save.mutate(
                  { id: driver.id, draft: patch, name: patch.name },
                  { onSuccess: () => setEditing(false) },
                )
              }
            />
          </>
        )}
      </Panel>
    </div>
  );
}

/**
 * Taking orders, and whether that is the rota talking.
 *
 * The switch shows the *effective* state and flipping it writes an override
 * rather than editing the week — editing the week to describe one evening is
 * the thing that would quietly become permanent.
 *
 * An override is invisible from the outside, so the line under it says which
 * way the rota is being overruled and offers to stop. An override left behind
 * is exactly the failure the rota was introduced to end.
 */
function Availability({
  courier,
  pending,
  onOverride,
}: {
  courier: Courier;
  pending: boolean;
  onOverride: (value: boolean | null) => void;
}) {
  const taking = isTakingOrders(courier);
  const overridden = isOverridden(courier);

  return (
    <div className="flex flex-col items-start gap-xxs pt-xs">
      <Toggle
        on={taking}
        onChange={() => onOverride(!taking)}
        disabled={pending}
        labelOn={t("drivers.onShift")}
        labelOff={t("drivers.offShift")}
        className="w-[124px]"
      />
      {overridden && (
        <span className="flex flex-wrap items-center gap-sm text-[11px] text-text-faint">
          {taking ? t("drivers.overrideOn") : t("drivers.overrideOff")}
          <button
            type="button"
            onClick={() => onOverride(null)}
            className="font-semibold text-primary hover:underline"
          >
            {t("drivers.followRota")}
          </button>
        </span>
      )}
    </div>
  );
}

function Back() {
  return (
    <Link
      href="/drivers"
      className="flex w-fit items-center gap-xs text-[13px] font-semibold text-primary hover:underline"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {t("drivers.backToList")}
    </Link>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex min-w-[140px] flex-col gap-xxs rounded-lg border border-border bg-surface px-lg py-md">
      <span className="text-[24px] font-bold tabular-nums">{value}</span>
      <span className="text-[12px] text-text-faint">{label}</span>
      {/* What the average is over. An average with no denominator on screen is
          a number somebody has to take on trust, and this one's denominator is
          unusual — days since their first order, not a fixed week. */}
      {note && <span className="text-[11px] text-text-faint">{note}</span>}
    </div>
  );
}

/**
 * An average, to one decimal, with the decimal dropped when it is a whole
 * number.
 *
 * `2.0` reads as a measurement and `2` reads as a count; the first is what this
 * is, so the point stays wherever it carries information and goes when it does
 * not. Two decimals would imply a precision that four hand-overs over three
 * days does not have.
 */
function average(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
