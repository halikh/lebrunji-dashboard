"use client";

import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  MessageCircle,
  Pencil,
  UserMinus,
  UserPlus,
  UserX,
} from "lucide-react";
import { useState } from "react";

import {
  Button,
  Card,
  ConfirmDialog,
  Copyable,
  EmptyState,
  Notice,
  Page,
  PageHeader,
  Section,
  Segmented,
  Sheet,
  Skeleton,
  Stat,
  StatusBadge,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  TwoColumn,
} from "@/components/ui";
import {
  changed,
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import type { DayHours } from "@/features/catalog/api/hours";
import { Price } from "@/features/reference/price";
import { useMoney } from "@/features/reference/use-currencies";
import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";
import { formatPhone } from "@/lib/phone";
import { startOfBusinessDay, startOfBusinessDayPlus } from "@/lib/time";

import type { Courier, Dispatch } from "./api/couriers";
import { AvailabilityControl, ShiftBadge, ShiftLine } from "./availability";
import { HoursGrid, WeekSummary } from "./hours-grid";
import {
  useCourier,
  useDispatches,
  useSaveCourier,
  useSetCourierActive,
} from "./use-couriers";

/**
 * One driver, and what they have been given.
 *
 * ## What the history actually claims
 *
 * Every row says the operator **opened a chat** about that order with this
 * driver — not that it was read or that the food arrived; WhatsApp tells the
 * dashboard nothing back (0083). The caveat is on screen because the screen is
 * what somebody reads while working out who had an order that went missing.
 */
export function DriverProfile({ id }: { id: string }) {
  const courier = useCourier(id);
  const dispatches = useDispatches(id);
  const driver = courier.data ?? null;

  if (courier.isPending) {
    return (
      <Page>
        <PageHeader title={<Skeleton className="h-7 w-48" />} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5" aria-busy>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </Page>
    );
  }

  if (courier.isError || !driver) {
    return (
      <Page>
        <PageHeader title={t("drivers.title")} />
        <Card>
          {courier.isError ? (
            <EmptyState
              icon={<AlertCircle />}
              title={t("common.loadFailed")}
              action={
                <Button onClick={() => void courier.refetch()}>
                  {t("common.retry")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<UserX />}
              title={t("drivers.notFound")}
              description={t("drivers.notFoundBody")}
            />
          )}
        </Card>
      </Page>
    );
  }

  return (
    <Loaded
      driver={driver}
      rows={dispatches.data ?? []}
      dispatches={dispatches}
    />
  );
}

function Loaded({
  driver,
  rows,
  dispatches,
}: {
  driver: Courier;
  rows: Dispatch[];
  dispatches: ReturnType<typeof useDispatches>;
}) {
  const clock = useClock();
  const setActive = useSetCourierActive();
  const [confirming, setConfirming] = useState(false);
  const [editingHours, setEditingHours] = useState(false);
  // Today is the trading day, cut where the stat tiles cut it, so the
  // "Today" tile and the "Today" list always say the same number.
  const [range, setRange] = useState<"today" | "all">("today");

  /**
   * Counts answer "what has happened"; averages answer "is this normal", which
   * a count cannot. Both windows are **trading days** — `startOfBusinessDay`
   * cuts at our closing hour — and a hand-over counts towards the day its
   * order was placed, so one made after we close stays with its evening.
   */
  const dayStart = startOfBusinessDay().getTime();
  const weekStart = startOfBusinessDayPlus(-6).getTime();
  // The day a hand-over counts towards is its order's: one placed at 23:55
  // and handed over after we close is still that night's.
  const at = (one: Dispatch) => new Date(one.placedAt).getTime();
  // Counted only while the order is still theirs. One handed on to somebody
  // else stays in the list, so who had it first can be read, but it is the
  // other driver's run, not theirs.
  const carried = rows.filter((one) => one.movedTo === null);
  const today = carried.filter((one) => at(one) >= dayStart).length;
  const thisWeek = carried.filter((one) => at(one) >= weekStart).length;

  /**
   * Averaged over the days since their **earliest hand-over**, not a fixed 7
   * or 30 — that would punish somebody who started on Tuesday, and `couriers`
   * records no start date. At least one day, so a first evening divides by one.
   */
  const earliest = carried.length
    ? Math.min(
        ...carried.map((one) =>
          startOfBusinessDay(new Date(one.placedAt)).getTime(),
        ),
      )
    : dayStart;
  const daysActive = Math.max(
    1,
    Math.round((dayStart - earliest) / 86_400_000) + 1,
  );
  const perDay = carried.length / daysActive;
  const shown =
    range === "today" ? rows.filter((one) => at(one) >= dayStart) : rows;

  return (
    <Page>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-3">
            <span className="truncate">{driver.name}</span>
          </span>
        }
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <ShiftBadge courier={driver} />
            <ShiftLine courier={driver} />
          </span>
        }
        description={
          // Copy, not dial: this number's job is to be pasted into WhatsApp,
          // and a `tel:` link on a desktop opens whatever the machine thinks
          // handles calls.
          <Copyable
            value={formatPhone(driver.phone)}
            label={t("drivers.copyPhone")}
            className="text-ink-2 tabular-nums"
          />
        }
        // Rarer and destructive: under ⋯, as Onfleet keeps a worker's
        // removal away from the buttons used every shift.
        more={
          driver.isActive
            ? [
                {
                  label: t("drivers.deactivate"),
                  icon: <UserMinus />,
                  tone: "danger",
                  onSelect: () => setConfirming(true),
                },
              ]
            : undefined
        }
        actions={
          <>
            <Button variant="secondary" asChild>
              <a
                href={`https://wa.me/${driver.phone}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle />
                {t("drivers.whatsapp")}
              </a>
            </Button>
            {driver.isActive ? (
              <Button variant="primary" asChild>
                <Link href={`/drivers/${driver.id}/edit`}>
                  <Pencil />
                  {t("drivers.edit")}
                </Link>
              </Button>
            ) : (
              <Button
                variant="primary"
                pending={setActive.isPending}
                onClick={() =>
                  setActive.mutate({
                    id: driver.id,
                    active: true,
                    name: driver.name,
                  })
                }
              >
                <UserPlus />
                {t("drivers.reactivate")}
              </Button>
            )}
          </>
        }
      />

      {!driver.isActive && <Notice>{t("drivers.inactiveNote")}</Notice>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatTile label={t("drivers.statToday")} value={String(today)} />
        <StatTile label={t("drivers.statThisWeek")} value={String(thisWeek)} />
        {/* The denominator, said out loud: days since their first order is
            not the window anybody would assume. */}
        <StatTile
          label={t("drivers.statPerDay")}
          value={average(perDay)}
          hint={t("drivers.overDays", { count: daysActive })}
        />
        <StatTile
          label={t("drivers.statPerWeek")}
          value={average(perDay * 7)}
          hint={t("drivers.overDays", { count: daysActive })}
        />
        <StatTile
          label={t("drivers.statTotal")}
          value={String(carried.length)}
        />
      </div>

      <TwoColumn
        main={
          <Section
            title={t("drivers.profileHandovers")}
            description={
              rows.length > 0
                ? `${t("drivers.handoversBlurb")} ${t("drivers.profileCaveat")}`
                : undefined
            }
            bodyClassName="p-0"
            actions={
              rows.length > 0 && (
                <Segmented
                  size="sm"
                  value={range}
                  onChange={setRange}
                  items={[
                    {
                      key: "today",
                      // The rows the list will show, handed-on ones too —
                      // as "All" counts them.
                      label: t("drivers.rangeToday", {
                        count: rows.filter((one) => at(one) >= dayStart).length,
                      }),
                    },
                    {
                      key: "all",
                      label: t("drivers.rangeAll", { count: rows.length }),
                    },
                  ]}
                />
              )
            }
          >
            {dispatches.isPending ? (
              <div className="flex flex-col gap-2 p-5" aria-busy>
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : dispatches.isError ? (
              <EmptyState
                icon={<AlertCircle />}
                title={t("common.loadFailed")}
                action={
                  <Button onClick={() => void dispatches.refetch()}>
                    {t("common.retry")}
                  </Button>
                }
              />
            ) : rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-ink-3">
                {t("drivers.profileNone")}
              </p>
            ) : shown.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-ink-3">
                {t("drivers.noneToday")}
              </p>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>{t("drivers.colOrder")}</Th>
                    <Th>{t("drivers.colHanded")}</Th>
                    <Th>{t("drivers.colStatus")}</Th>
                    <Th className="text-end">{t("drivers.colDelivery")}</Th>
                    <Th className="text-end">
                      {t("drivers.colWithoutCommission")}
                    </Th>
                    <Th className="text-end">{t("drivers.colCommission")}</Th>
                    <Th className="text-end">{t("drivers.colToCollect")}</Th>
                  </Tr>
                </THead>
                <TBody>
                  {shown.map((row) => (
                    <Tr key={row.id} interactive className="relative">
                      <Td>
                        <Link
                          href={`/orders/${row.orderId}`}
                          className="font-semibold text-ink tabular-nums after:absolute after:inset-0 hover:text-accent"
                        >
                          {row.orderCode}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-2">
                        {clock.dayAndTime(row.dispatchedAt)}
                      </Td>
                      {row.movedTo !== null ? (
                        // Handed on: no status or money of theirs to show.
                        <>
                          <Td className="text-ink-3">
                            {t("drivers.movedTo", { name: row.movedTo })}
                          </Td>
                          <Td className="text-end text-ink-4">—</Td>
                          <Td className="text-end text-ink-4">—</Td>
                          <Td className="text-end text-ink-4">—</Td>
                          <Td className="text-end text-ink-4">—</Td>
                        </>
                      ) : (
                        <>
                          <Td>
                            <StatusBadge slug={row.statusSlug} />
                          </Td>
                          <Td className="text-end tabular-nums">
                            <Price
                              value={row.deliveryFee}
                              code={row.currencyCode}
                              shopRate={row.shopRate}
                              align="end"
                            />
                          </Td>
                          <Td className="text-end tabular-nums">
                            <Price
                              value={row.orderTotal - row.commission}
                              code={row.currencyCode}
                              shopRate={row.shopRate}
                              align="end"
                            />
                          </Td>
                          <Td className="text-end tabular-nums">
                            <Price
                              value={row.commission}
                              code={row.currencyCode}
                              shopRate={row.shopRate}
                              align="end"
                            />
                          </Td>
                          {/* What the driver hands in to us: our commission
                              plus the delivery fee. */}
                          <Td className="text-end font-semibold tabular-nums">
                            <Price
                              value={row.commission + row.deliveryFee}
                              code={row.currencyCode}
                              shopRate={row.shopRate}
                              align="end"
                            />
                          </Td>
                        </>
                      )}
                    </Tr>
                  ))}
                </TBody>
                <HandoverTotals rows={shown} />
              </Table>
            )}
          </Section>
        }
        aside={
          <>
            {driver.isActive && (
              <Section
                title={t("drivers.nowTitle")}
                description={t("drivers.nowBlurb")}
              >
                <AvailabilityControl courier={driver} layout="card" />
              </Section>
            )}
            <Section
              title={t("drivers.weekTitle")}
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditingHours(true)}
                >
                  <CalendarClock />
                  {t("drivers.editHours")}
                </Button>
              }
            >
              <WeekSummary week={driver.hours} showNow={false} />
            </Section>
          </>
        }
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("drivers.deactivateTitle", { name: driver.name })}
        description={t("drivers.deactivateBody")}
        confirmLabel={t("drivers.deactivateConfirm")}
        tone="danger"
        onConfirm={() =>
          setActive.mutateAsync({
            id: driver.id,
            active: false,
            name: driver.name,
          })
        }
      />

      {editingHours && (
        <HoursSheet driver={driver} onClose={() => setEditingHours(false)} />
      )}
    </Page>
  );
}

/**
 * The week, edited without leaving the profile. Mounted only while open, so it
 * always starts from the saved week rather than a draft abandoned earlier.
 */
function HoursSheet({
  driver,
  onClose,
}: {
  driver: Courier;
  onClose: () => void;
}) {
  const save = useSaveCourier();
  const [hours, setHours] = useState<DayHours[]>(driver.hours);
  const dirty = changed(hours, driver.hours);
  useUnsavedChanges(dirty);
  const guard = useGuardedAction();
  const close = guard(onClose);

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && close()}
      title={t("drivers.hoursTitle")}
      description={t("drivers.hoursSheetBlurb")}
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!dirty || hours.length === 0}
            pending={save.isPending}
            onClick={() =>
              save.mutate(
                {
                  id: driver.id,
                  draft: { name: driver.name, phone: driver.phone, hours },
                  name: driver.name,
                },
                { onSuccess: onClose },
              )
            }
          >
            {t("drivers.saveHours")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <HoursGrid week={hours} onChange={setHours} disabled={save.isPending} />
        <div className="border-t border-line pt-5">
          <WeekSummary week={hours} onChange={setHours} />
        </div>
      </div>
    </Sheet>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <Stat label={label} value={value} hint={hint} />
    </Card>
  );
}

/**
 * The sums of the four money columns, under the rows they add up.
 *
 * - **Cancelled orders are left out.** Nothing was collected on them, and a
 *   total that counted them would be a figure the driver could never hand in.
 * - **One line per currency.** An order is recorded in what it was priced in,
 *   and lira and dollars are never added together.
 * - **The converted line only when it is honest.** Each order converts at its
 *   own shop's rate; when the orders in a currency do not share one, a single
 *   converted figure would be a rate nobody quoted, so it is left off.
 * - **It adds up what the table shows** — the latest hand-overs, not every one
 *   ever — so the totals and the rows above them always agree.
 */
function HandoverTotals({ rows }: { rows: Dispatch[] }) {
  const { format } = useMoney();
  // Handed on to somebody else: not theirs to hand money in for.
  const theirs = rows.filter((row) => row.movedTo === null);
  const counted = theirs.filter((row) => row.statusSlug !== "cancelled");
  const skipped = theirs.length - counted.length;

  const byCurrency = new Map<
    string,
    {
      fee: number;
      net: number;
      commission: number;
      rates: Set<number | null>;
    }
  >();
  for (const row of counted) {
    const sum = byCurrency.get(row.currencyCode) ?? {
      fee: 0,
      net: 0,
      commission: 0,
      rates: new Set<number | null>(),
    };
    sum.fee += row.deliveryFee;
    sum.net += row.orderTotal - row.commission;
    sum.commission += row.commission;
    sum.rates.add(row.shopRate);
    byCurrency.set(row.currencyCode, sum);
  }
  const sums = [...byCurrency.entries()];

  const amount = (value: number, code: string, rates: Set<number | null>) =>
    rates.size === 1 ? (
      <Price value={value} code={code} shopRate={[...rates][0]} align="end" />
    ) : (
      <span className="tabular-nums">{format(value, code)}</span>
    );

  return (
    <tfoot className="border-t-2 border-line-strong bg-subtle font-semibold">
      <Tr>
        <Td colSpan={3}>
          <span className="flex flex-col">
            {t("drivers.totalsRow")}
            {skipped > 0 && (
              <span className="text-[12px] font-normal text-ink-4">
                {t("drivers.totalsSkipped")}
              </span>
            )}
          </span>
        </Td>
        <Td className="py-2 text-end">
          <span className="flex flex-col items-end gap-1">
            {sums.length === 0
              ? "—"
              : sums.map(([code, sum]) => (
                  <span key={code}>{amount(sum.fee, code, sum.rates)}</span>
                ))}
          </span>
        </Td>
        <Td className="py-2 text-end">
          <span className="flex flex-col items-end gap-1">
            {sums.length === 0
              ? "—"
              : sums.map(([code, sum]) => (
                  <span key={code}>{amount(sum.net, code, sum.rates)}</span>
                ))}
          </span>
        </Td>
        <Td className="py-2 text-end">
          <span className="flex flex-col items-end gap-1">
            {sums.length === 0
              ? "—"
              : sums.map(([code, sum]) => (
                  <span key={code}>
                    {amount(sum.commission, code, sum.rates)}
                  </span>
                ))}
          </span>
        </Td>
        <Td className="py-2 text-end">
          <span className="flex flex-col items-end gap-1">
            {sums.length === 0
              ? "—"
              : sums.map(([code, sum]) => (
                  <span key={code}>
                    {amount(sum.commission + sum.fee, code, sum.rates)}
                  </span>
                ))}
          </span>
        </Td>
      </Tr>
    </tfoot>
  );
}

/**
 * One decimal, dropped when whole: `2.0` reads as a measurement and `2` as a
 * count. Two decimals would claim a precision four hand-overs do not have.
 */
function average(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
