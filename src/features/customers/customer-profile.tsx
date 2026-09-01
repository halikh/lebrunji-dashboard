"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Button, cx } from "@/components/ui";
import { ROW } from "@/components/ui/row";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Copyable } from "@/components/ui/copyable";
import { Avatar } from "@/components/ui/avatar";
import { BarChart, HeatStrip } from "@/components/ui/chart";
import { InfiniteSentinel } from "@/components/ui/infinite-sentinel";
import { SectionTab, tabArrowHandler } from "@/components/ui/tab";
// Aliased, and not for taste: imported as `Map` it shadows the built-in, and
// `new Map<string, number>()` below then fails to compile with an error that
// points at the arithmetic rather than at the import.
import { Map as PinMap } from "@/components/ui/map";
import { Price } from "@/features/reference/price";
import { useMoney } from "@/features/reference/use-currencies";
import { t, type TranslationKey } from "@/i18n/translations";
import { statusTone } from "@/lib/order-status";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatDateTime, formatMonthKey } from "@/lib/time";

import type {
  CustomerAddress,
  CustomerOrder,
  CustomerRedemption,
} from "./api/customers";
import { StatusChip, nameOf } from "./customers-screen";
import {
  useCloseCustomerAccount,
  useCustomer,
  useCustomerOrders,
  useCustomerRedemptions,
  useCustomerStats,
  useSetCustomerActive,
} from "./use-customers";

/**
 * One customer, in full.
 *
 * ## Why this is a page and not a panel
 *
 * A panel is the right shape for a form beside a list, and the wrong shape for
 * a record. This carries a history, a set of addresses that only mean anything
 * on a map, everything the customer has ever ordered, and two actions that end
 * with somebody signed out of their account. None of that fits a 420px column,
 * and squeezing it in would make the map — the one part of the screen where
 * more pixels are more information — the smallest thing on it.
 *
 * It is also a URL, which is the practical half: an operator on the phone can
 * send a colleague exactly the person they are looking at.
 *
 * ## Three queries, not one
 *
 * The profile, the totals and the orders load separately and paint as they
 * arrive. The name and the phone number are what somebody on a call needs
 * *now*; totalling a hundred orders to show a lifetime figure should not hold
 * them up. Each block says which of the four states it is in rather than the
 * page having one.
 *
 * ## Two columns, split by what each half wants
 *
 * The same reasoning as the store's details tab. Who they are and what they
 * have bought reads as a column; where they are wants width. Stretching the
 * text across the whole page would make a phone number a thousand pixels wide,
 * which is harder to read, not easier.
 */
/**
 * The profile's own tabs.
 *
 * Not a nicety: any one of these lists is unbounded. A customer who has ordered
 * weekly for two years has a hundred orders, and stacking that under their
 * addresses means the map — which is the reason the addresses are worth
 * showing at all — sits below a screen and a half of order rows nobody scrolled
 * past to reach it. Overview is what somebody on a call needs in the first five
 * seconds; the rest are things you go and look at.
 */
const TABS: { key: ProfileTab; labelKey: TranslationKey }[] = [
  { key: "overview", labelKey: "customers.tabOverview" },
  { key: "orders", labelKey: "customers.orders" },
  { key: "addresses", labelKey: "customers.addresses" },
  { key: "promotions", labelKey: "customers.promotions" },
];

type ProfileTab = "overview" | "orders" | "addresses" | "promotions";

export function CustomerProfile({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = params.get("tab");
  const tab: ProfileTab = TABS.some((one) => one.key === requested)
    ? (requested as ProfileTab)
    : "overview";

  /**
   * The tab lives in the URL, `replace` rather than `push`.
   *
   * Switching a tab is not a journey: Back should return to the customers list
   * rather than walk through the tabs somebody looked at on the way.
   */
  function show(next: ProfileTab) {
    const query = new URLSearchParams(params);
    if (next === "overview") query.delete("tab");
    else query.set("tab", next);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const customer = useCustomer(id);
  const stats = useCustomerStats(id);
  const orders = useCustomerOrders(id);
  const redemptions = useCustomerRedemptions(id);
  const { format } = useMoney();

  const setActive = useSetCustomerActive();
  const close = useCloseCustomerAccount();

  if (customer.isPending) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-text-faint">
        {t("common.loading")}
      </div>
    );
  }

  if (customer.isError || !customer.data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-lg text-center">
        <h1 className="text-[18px]">{t("customers.failedTitle")}</h1>
        <div className="flex gap-sm">
          <Button variant="secondary" onClick={() => void customer.refetch()}>
            {t("common.retry")}
          </Button>
          <Link href="/customers">
            <Button variant="secondary">{t("customers.backToList")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const row = customer.data;
  const closed = row.deletedAt !== null;
  const name = nameOf(row);
  const orderRows = orders.data?.pages.flatMap((page) => page.orders) ?? [];

  /**
   * What the promotions have actually cost, per currency.
   *
   * Per currency for the same reason the spend tiles are: `0028` lets a
   * customer order from shops pricing differently, and a sum across two is a
   * number in no currency at all.
   */
  const saved = [
    ...(redemptions.data ?? [])
      .reduce((totals, one) => {
        totals.set(
          one.currencyCode,
          (totals.get(one.currencyCode) ?? 0) + one.amount,
        );
        return totals;
      }, new Map<string, number>())
      .entries(),
  ];

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex shrink-0 flex-col gap-md border-b border-border bg-surface px-xxl py-lg">
        {/* The same back link the store screen carries — arrow, size, colour
            and hover all matching, because two spellings of "go up a level"
            are two things to recognise. */}
        <Link
          href="/customers"
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
          {t("customers.backToList")}
        </Link>

        <div className="flex flex-wrap items-center gap-lg">
          {/* The same colour this customer wears on the list, because it is
              hashed from their id rather than picked at render. */}
          <Avatar id={row.id} name={row.name} size={52} />

          {/* Everything that identifies the person, in one column, read
              downward: who they are, how to reach them, since when, whether
              the account works, and how they read the app.

              The phone is here rather than in a Contact block on the Overview
              tab because it is the single most-wanted fact on the page — the
              operator is usually already dialling — and a fact you have to
              change tabs for is one the tabs have hidden. The preferences sit
              last and small: they qualify everything above without being
              something anybody came for. */}
          <div className="flex min-w-0 flex-grow flex-col items-start gap-xs">
            <h1
              className={cx(
                "truncate text-[24px]",
                !row.name.trim() && "italic text-text-soft",
              )}
            >
              {name}
            </h1>

            {/* A `tel:` link, because the operator is usually about to ring
                them — and copyable, because half the time they are reading it
                into something else. */}
            <Copyable
              value={formatPhone(row.phone)}
              href={`tel:${formatPhone(row.phone)}`}
              label={t("customers.copyPhone")}
            />

            <span className="text-[12px] text-text-faint">
              {t("customers.joined", { when: formatDateTime(row.createdAt) })}
            </span>

            <StatusChip customer={row} />

            <span className="flex flex-wrap items-center gap-x-md gap-y-xxs text-[12px] text-text-faint">
              <span>
                {t("customers.prefLanguage", {
                  value: row.locale ?? t("customers.notSet"),
                })}
              </span>
              <span>
                {t("customers.prefCurrency", {
                  // Null is not "unset" here: `0028` says it means *show each
                  // store's own pricing currency*, which is a real answer.
                  value: row.currencyCode ?? t("customers.shopsOwn"),
                })}
              </span>
            </span>
          </div>

          {/* Both actions are confirmed, and they are not the same weight.
              Suspension is a door held shut; closing releases the phone number,
              so the customer signing up again gets a *new* account and this one
              can never be reopened. A closed account offers neither. */}
          {!closed && (
            <div className="flex shrink-0 items-center gap-sm">
              <ConfirmButton
                onConfirm={async () => {
                  await setActive.mutateAsync({
                    id: row.id,
                    isActive: !row.isActive,
                    name,
                  });
                }}
                titleKey={
                  row.isActive
                    ? "customers.suspendTitle"
                    : "customers.reinstateTitle"
                }
                bodyKey={
                  row.isActive
                    ? "customers.suspendBody"
                    : "customers.reinstateBody"
                }
                confirmKey={
                  row.isActive
                    ? "customers.suspendConfirm"
                    : "customers.reinstateConfirm"
                }
                params={{ name }}
                variant={row.isActive ? "danger" : "primary"}
                triggerVariant="secondary"
                size="sm"
              >
                {row.isActive
                  ? t("customers.suspend")
                  : t("customers.reinstate")}
              </ConfirmButton>

              <ConfirmButton
                onConfirm={async () => {
                  await close.mutateAsync({ id: row.id, name });
                }}
                titleKey="customers.closeTitle"
                bodyKey="customers.closeBody"
                confirmKey="customers.closeConfirm"
                params={{ name, phone: formatPhone(row.phone) }}
                variant="danger"
                triggerVariant="danger"
                size="sm"
              >
                {t("customers.close")}
              </ConfirmButton>
            </div>
          )}
        </div>
      </header>

      {/* Section tabs, not filter tabs — the underline the store screen uses,
          because these are chapters of one record rather than buckets of a
          list. The count rides in the label, where a chapter can carry one
          without pretending to be a status.

          The strip sits under the header, so the name and the actions stay put
          while the content beneath them changes. */}
      <div
        role="tablist"
        // The customer's own name, not a generic "tabs": a screen reader
        // announcing "Rami Haddad, tab list" says which record these belong to.
        aria-label={name}
        className="-mb-px flex shrink-0 gap-lg overflow-x-auto border-b border-border bg-surface px-xxl pt-sm"
      >
        {TABS.map(({ key, labelKey }) => (
          <SectionTab
            key={key}
            label={t(labelKey)}
            active={tab === key}
            onClick={() => show(key)}
            onKeyDown={tabArrowHandler(
              TABS.map((one) => one.key),
              tab,
              show,
            )}
          />
        ))}
      </div>

      {/* Siblings rather than one swapped child, and `hidden` rather than
          unmounting. Remounting would refetch, lose the operator's scroll
          position, and flash a skeleton at somebody returning to a list they
          were just reading — and on this page it would do that to an infinite
          list they had scrolled a long way down. */}
      <div className="min-h-0 flex-grow overflow-y-auto">
        <div className={cx("p-xxl", tab !== "overview" && "hidden")}>
          <div className="flex flex-col gap-xxl">
            {closed && (
              <p className="rounded-md border border-border bg-neutral-fill px-lg py-md text-[13px] text-text-soft">
                {t("customers.closedNote", {
                  when: formatDate(row.deletedAt as string),
                })}
              </p>
            )}

            <Block title={t("customers.summary")}>
              {stats.isPending && (
                <p className="text-[13px] text-text-faint">
                  {t("common.loading")}
                </p>
              )}
              {stats.isError && (
                <p role="alert" className="text-[13px] text-danger">
                  {t("customers.statsFailed")}
                </p>
              )}
              {stats.isSuccess && (
                <>
                  <div className="grid grid-cols-2 gap-md xl:grid-cols-4">
                    <Tile
                      label={t("customers.tileOrders")}
                      value={String(stats.data.orderCount)}
                    />
                    {/* Per currency, because `0028` lets a customer order from
                        shops pricing differently and a sum across two is a
                        number in no currency at all. Usually one tile. */}
                    {stats.data.totals.map((total) => (
                      <Tile
                        key={total.code}
                        label={t("customers.tileSpent", { code: total.code })}
                        value={
                          <Price
                            value={total.amount}
                            code={total.code}
                            className="text-[20px] font-semibold"
                          />
                        }
                      />
                    ))}
                    {saved.map(([code, amount]) => (
                      <Tile
                        key={`saved-${code}`}
                        label={t("customers.tileSaved", { code })}
                        value={
                          <Price
                            value={amount}
                            code={code}
                            className="text-[20px] font-semibold"
                          />
                        }
                      />
                    ))}
                    <Tile
                      label={t("customers.tileFirst")}
                      value={
                        stats.data.firstOrderAt
                          ? formatDate(stats.data.firstOrderAt)
                          : t("customers.never")
                      }
                    />
                    <Tile
                      label={t("customers.tileLast")}
                      value={
                        stats.data.lastOrderAt
                          ? formatDate(stats.data.lastOrderAt)
                          : t("customers.never")
                      }
                    />
                  </div>

                  {/* The cap is the assumption, made visible. Quietly
                      under-reporting a lifetime figure is worse than saying it
                      is a floor. */}
                  {stats.data.truncated && (
                    <p className="text-[12px] text-text-faint">
                      {t("customers.statsTruncated")}
                    </p>
                  )}
                </>
              )}
            </Block>

            {/* The tiles say how much; the charts say the two things a figure
                cannot — whether they are still ordering, and when. A customer
                who stopped in March is four flat bars, which no total on this
                page would ever reveal. */}
            {stats.isSuccess && stats.data.orderCount > 0 && (
              <div className="grid gap-xxl xl:grid-cols-[3fr_2fr]">
                <Block
                  title={
                    stats.data.seriesCurrency
                      ? t("customers.chartMonthsMoney", {
                          code: stats.data.seriesCurrency,
                        })
                      : t("customers.chartMonths")
                  }
                >
                  <BarChart
                    // `active` here rather than the overview's `accent`: this
                    // is about the person in front of you, and the app's accent
                    // is what says so. The business-wide charts stay green.
                    tone="active"
                    title={t("customers.chartMonthsAria")}
                    bars={stats.data.months.map((month) => {
                      const code = stats.data.seriesCurrency;
                      // Height follows the money when there is one currency to
                      // draw, and the order count when there is not — a bar
                      // whose height mixed dollars and lira would be a chart of
                      // nothing.
                      const value = code ? month.amount : month.orders;
                      return {
                        key: month.key,
                        label: formatMonthKey(month.key),
                        value,
                        title: code
                          ? t("customers.chartMonthTitleMoney", {
                              month: formatMonthKey(month.key),
                              orders: month.orders,
                              amount: format(month.amount, code),
                            })
                          : t("customers.chartMonthTitle", {
                              month: formatMonthKey(month.key),
                              orders: month.orders,
                            }),
                      };
                    })}
                  />
                </Block>

                <Block title={t("customers.chartWeekdays")}>
                  <HeatStrip
                    // The same `info` the overview's hours grid uses — a
                    // pattern of time reads the same way whoever it is about.
                    tone="info"
                    title={t("customers.chartWeekdaysAria")}
                    // Rotated to Monday-first here, in the presentation layer.
                    // The stored order is Sunday-first because that is what
                    // `Date#getDay` and `store_hours.day_of_week` both use, and
                    // the two orders are kept deliberately separate so nothing
                    // reaching the database passes through a display position.
                    cells={[1, 2, 3, 4, 5, 6, 0].map((day) => ({
                      key: String(day),
                      label: WEEKDAYS[day],
                      value: stats.data.byWeekday[day] ?? 0,
                    }))}
                  />
                </Block>
              </div>
            )}
          </div>
        </div>

        <div className={cx("p-xxl", tab !== "orders" && "hidden")}>
          <div className="flex flex-col gap-sm">
            {orders.isPending && (
              <div aria-hidden className="flex flex-col gap-sm">
                {[0, 1, 2, 3].map((one) => (
                  <div
                    key={one}
                    className="h-[62px] rounded-md border border-border bg-surface opacity-60"
                  />
                ))}
              </div>
            )}

            {orders.isError && (
              <p role="alert" className="text-[13px] font-medium text-danger">
                {t("customers.ordersFailed")}
              </p>
            )}

            {orders.isSuccess && orderRows.length === 0 && (
              <p className="rounded-md border border-dashed border-border px-lg py-xl text-center text-[13px] text-text-soft">
                {t("customers.noOrders")}
              </p>
            )}

            {orderRows.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}

            {orders.isSuccess && orderRows.length > 0 && (
              <InfiniteSentinel
                hasMore={orders.hasNextPage}
                loading={orders.isFetchingNextPage}
                onLoadMore={() => void orders.fetchNextPage()}
              />
            )}
          </div>
        </div>

        <div className={cx("p-xxl", tab !== "addresses" && "hidden")}>
          {row.addresses.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-lg py-xl text-center text-[13px] text-text-soft">
              {t("customers.noAddresses")}
            </p>
          ) : (
            // A grid, because each card is a map and a map wants width. One
            // column of full-width maps would be one address per screen.
            <ul className="grid gap-lg md:grid-cols-2 2xl:grid-cols-3">
              {row.addresses.map((address) => (
                <AddressCard key={address.id} address={address} />
              ))}
            </ul>
          )}
        </div>

        <div className={cx("p-xxl", tab !== "promotions" && "hidden")}>
          <div className="flex flex-col gap-sm">
            {redemptions.isPending && (
              <p className="text-[13px] text-text-faint">
                {t("common.loading")}
              </p>
            )}

            {redemptions.isError && (
              <p role="alert" className="text-[13px] font-medium text-danger">
                {t("customers.promotionsFailed")}
              </p>
            )}

            {redemptions.isSuccess && redemptions.data.length === 0 && (
              <p className="rounded-md border border-dashed border-border px-lg py-xl text-center text-[13px] text-text-soft">
                {t("customers.noPromotions")}
              </p>
            )}

            {redemptions.isSuccess && redemptions.data.length > 0 && (
              <>
                <p className="flex items-baseline gap-sm ps-md pb-sm text-[13px] text-text-soft">
                  {t("customers.savedTotal")}
                  {saved.map(([code, amount]) => (
                    <Price
                      key={code}
                      value={amount}
                      code={code}
                      className="text-[13px] font-semibold"
                    />
                  ))}
                </p>
                <ul className="flex flex-col gap-sm">
                  {redemptions.data.map((one) => (
                    <RedemptionRow key={one.id} redemption={one} />
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddressCard({ address }: { address: CustomerAddress }) {
  return (
    <li className="flex flex-col gap-md rounded-md border border-border bg-surface p-lg">
      <div className="flex items-center gap-sm">
        <span className="min-w-0 flex-grow truncate text-[13px] font-semibold">
          {address.label ?? t("customers.unlabelled")}
        </span>
        {address.isDefault && (
          <span className="shrink-0 rounded-sm bg-accent-wash px-sm text-[11px] font-semibold">
            {t("customers.defaultAddress")}
          </span>
        )}
      </div>

      <p className="text-[13px] text-text-soft">{address.line}</p>

      {/* The map is why the addresses are in the wide column. A line of text is
          an address somebody typed; the pin is where a courier is actually
          sent, and the two disagree more often than anyone expects. */}
      <PinMap
        latitude={address.latitude}
        longitude={address.longitude}
        label={address.label ?? address.line}
        emptyKey="customers.noPin"
        className="h-[180px] w-full rounded-md"
      />

      {/* An address with no pin falls to the top delivery band —
          `delivery_fee_for_km` treats an unknown distance that way — so it
          silently overcharges every order to it. */}
      {address.latitude === null && (
        <p className="text-[12px] text-danger">{t("customers.noPinWarning")}</p>
      )}
    </li>
  );
}

function OrderRow({ order }: { order: CustomerOrder }) {
  return (
    <li className={cx(ROW, "border-border")}>
      <span className="flex min-w-0 flex-grow flex-col gap-xxs">
        {/* Straight to the order in the queue, with the panel open on it —
            which is the thing the operator wants next, every time. */}
        <Link
          href={`/?order=${order.id}`}
          className="truncate tabular-nums text-[13px] font-semibold after:absolute after:inset-0"
        >
          {order.code}
        </Link>
        <span className="truncate text-[12px] text-text-faint">
          {order.addressLine}
        </span>
      </span>

      {/* One chip per shop on the order. An order spanning two shops has two
          statuses, and showing only the first would be a claim about the order
          that is true only when it has one shop on it.

          Painted from the order-status ramp, so "Delivered" here is the same
          green as "Delivered" in the queue. Grey chips would have made a
          cancelled order and a delivered one look alike on the one screen where
          somebody is scanning a history for the odd one out — and a status
          colour that is defined twice is a status colour that will differ. */}
      <span className="flex shrink-0 flex-wrap items-center gap-xs">
        {order.statuses.map((status) => {
          const tone = statusTone(status.slug);
          return (
            <span
              key={status.slug}
              // A dot as well as the ground, for the reason the queue's tabs
              // carry one: colour alone is not a distinction a colour-blind
              // operator can rely on.
              style={{ background: tone.wash, color: tone.ink }}
              className="flex items-center gap-xs rounded-sm px-sm py-[1px] text-[11px] font-semibold"
            >
              <span
                aria-hidden
                className="size-[6px] shrink-0 rounded-full"
                style={{ background: tone.dot }}
              />
              {status.name}
            </span>
          );
        })}
      </span>

      <span className="shrink-0 text-[12px] text-text-faint">
        {formatDate(order.placedAt)}
      </span>

      <Price
        value={order.total}
        code={order.currencyCode}
        align="end"
        className="text-[13px] font-semibold"
      />
    </li>
  );
}

/**
 * Sunday-first, matching the stored index.
 *
 * Not translated: they are two-letter axis labels on a chart, and the chrome is
 * English by decision. When a second language arrives they become keys like
 * everything else — the array is the seam.
 */
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function RedemptionRow({ redemption }: { redemption: CustomerRedemption }) {
  return (
    <li className={cx(ROW, "border-border")}>
      <span className="flex min-w-0 flex-grow flex-col gap-xxs">
        {/* The label is the promotion's name **as it was at the time** —
            `0016` calls a redemption a receipt line, history rather than
            content, so it is never re-translated or renamed after the fact.
            Reading the discount's current name here would let a merchant
            silently rewrite what a customer was told. */}
        <span className="truncate text-[13px] font-semibold">
          {redemption.label || t("customers.unnamedPromotion")}
        </span>
        <Link
          href={`/?order=${redemption.orderId}`}
          className="truncate tabular-nums text-[12px] text-text-faint after:absolute after:inset-0"
        >
          {redemption.orderCode}
        </Link>
      </span>

      <span className="shrink-0 text-[12px] text-text-faint">
        {formatDate(redemption.redeemedAt)}
      </span>

      {/* Negative, because this is what came *off*. A bare figure in a column
          beside the order totals would read as another thing they paid. */}
      <span className="shrink-0 text-accent-deep">
        <Price
          value={redemption.amount}
          code={redemption.currencyCode}
          align="end"
          className="text-[13px] font-semibold"
        />
      </span>
    </li>
  );
}

function Block({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-md">
      <div className="flex items-baseline justify-between gap-md">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-xxs rounded-md border border-border bg-surface px-lg py-md">
      <span className="text-[12px] text-text-faint">{label}</span>
      <span className="text-[20px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}
