"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Button, cx } from "@/components/ui";
import { BarChart, HBarList, HeatGrid } from "@/components/ui/chart";
import { SectionTab, tabArrowHandler } from "@/components/ui/tab";
import { Price } from "@/features/reference/price";
import { useMoney } from "@/features/reference/use-currencies";
import {
  useOrderStatuses,
  useStatusCounts,
} from "@/features/orders/use-orders";
import { pickLocalized } from "@/i18n/db-text";
import { t, type TranslationKey } from "@/i18n/translations";
import { statusTone } from "@/lib/order-status";
import { formatDate } from "@/lib/time";

import type { Stats } from "./api/stats";
import { businessRange, previousRange, useStats } from "./use-stats";

/**
 * The overview.
 *
 * ## Two blocks, and only one of them has a date range
 *
 * **"Needs you now" is deliberately unfiltered.** An order placed at 23:50 on
 * Tuesday and still unconfirmed is not Tuesday's business — it is the most
 * urgent thing on the screen, and a date range is exactly what would make it
 * invisible. It answers *what do I do next*.
 *
 * Everything under it answers *how are we doing*, which is a question about a
 * period and is useless without one.
 *
 * Putting them on one screen with one filter would have quietly made the first
 * question unanswerable, which is the sort of mistake that only shows up as an
 * order nobody dealt with.
 *
 * ## The range lives in the URL
 *
 * `?days=30`, so a view can be linked, reloaded or sent to somebody — the same
 * rule every other filter here follows.
 *
 * ## Comparison is the point
 *
 * Every tile carries its change against the period before, and the revenue bars
 * carry the previous period ghosted behind them. A revenue figure on its own
 * answers nothing anybody asked: "£4,200" is only information next to what it
 * was last month. That is why the previous period is fetched at all.
 */

const RANGES: { days: number; labelKey: TranslationKey }[] = [
  { days: 7, labelKey: "reports.range7" },
  { days: 30, labelKey: "reports.range30" },
  { days: 90, labelKey: "reports.range90" },
];

export function ReportsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = Number(params.get("days"));
  const days = RANGES.some((one) => one.days === requested) ? requested : 30;

  const current = businessRange(days);
  const before = previousRange(days);

  const stats = useStats(current.from, current.to);
  const prior = useStats(before.from, before.to);

  const statuses = useOrderStatuses();
  // Unfiltered by date, deliberately — see the note above.
  const counts = useStatusCounts(statuses.data, "all");

  const { format, currencies } = useMoney();

  // The funnel comes back keyed on slugs; the readable names are already
  // loaded for the tiles above. Showing `driver-sent` to an operator when the
  // product calls it "On the way" is a gap nobody would guess is cosmetic.
  const statusNames = new Map(
    (statuses.data ?? []).map((status) => [status.slug, status.name]),
  );

  function show(next: number) {
    const query = new URLSearchParams(params);
    if (next === 30) query.delete("days");
    else query.set("days", String(next));
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  /**
   * The currency every figure here is denominated in.
   *
   * `orders.currency_code` is per order and `place_order` refuses a basket that
   * mixes two — but nothing stops two *shops* pricing differently, so a range
   * could in principle span both, and `api_v1_admin_stats` sums regardless.
   * That is a real limitation, stated rather than hidden: the figures would
   * then be a sum over mixed units.
   *
   * Until a merchant actually runs two currencies, the first active one is the
   * honest label. When one does, this is the seam that grows a per-currency
   * breakdown, exactly as the customer profile's totals already have.
   */
  const code = currencies?.[0]?.code ?? "";

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 items-center gap-lg border-b border-border bg-surface px-xxl py-lg">
        <h1 className="flex-grow text-[24px]">{t("reports.title")}</h1>
      </div>

      <div className="min-h-0 flex-grow overflow-y-auto">
        <div className="flex flex-col gap-xxl p-xxl">
          {/* ---- What still needs somebody ---------------------------------
              First, and above the range, because it is the thing that cannot
              wait — and because putting it below would imply the range applies
              to it. */}
          <section className="flex flex-col gap-md">
            <div className="flex items-baseline justify-between gap-md">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">
                {t("reports.needsYou")}
              </h2>
              <span className="text-[12px] text-text-faint">
                {t("reports.needsYouNote")}
              </span>
            </div>

            {statuses.isError || counts.isError ? (
              <p role="alert" className="text-[13px] font-medium text-danger">
                {t("reports.countsFailed")}
              </p>
            ) : (
              <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
                {(statuses.data ?? [])
                  // Terminal statuses are not work. Read from `progress`
                  // rather than a hardcoded list of slugs, because
                  // `order_statuses` exists to be added to and a new step
                  // must not silently fall outside the set.
                  .filter((status) => status.progress !== null)
                  .map((status) => {
                    const tone = statusTone(status.slug);
                    const count = counts.data?.[status.slug] ?? 0;
                    return (
                      <Link
                        key={status.id}
                        // Straight into the queue on that tab — the number is
                        // only useful if you can act on what it counts.
                        href={`/?status=${status.slug}`}
                        className="flex items-center gap-md rounded-md border border-border bg-surface px-lg py-md hover:border-active"
                      >
                        <span
                          aria-hidden
                          className="size-[9px] shrink-0 rounded-full"
                          style={{ background: tone.dot }}
                        />
                        <span className="min-w-0 flex-grow truncate text-[13px] text-text-soft">
                          {status.name}
                        </span>
                        <span className="shrink-0 text-[22px] font-semibold tabular-nums">
                          {counts.isPending ? "—" : count}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            )}
          </section>

          {/* ---- How we are doing ----------------------------------------- */}
          <section className="flex flex-col gap-lg border-t border-border pt-xxl">
            <div className="flex flex-wrap items-center justify-between gap-md">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">
                {t("reports.performance")}
              </h2>

              <div role="tablist" className="-mb-px flex gap-lg">
                {RANGES.map(({ days: option, labelKey }) => (
                  <SectionTab
                    key={option}
                    label={t(labelKey)}
                    active={days === option}
                    onClick={() => show(option)}
                    onKeyDown={tabArrowHandler(
                      RANGES.map((one) => one.days),
                      days,
                      show,
                    )}
                  />
                ))}
              </div>
            </div>

            <p className="ps-md text-[12px] text-text-faint">
              {t("reports.rangeNote", {
                from: formatDate(current.from),
                // The range is half-open, so the last day *in* it is the day
                // before `to`. Printing `to` would name a day the figures do
                // not include.
                to: formatDate(new Date(current.to.getTime() - 1)),
              })}
            </p>

            {stats.isError && (
              <div className="flex flex-col items-center gap-lg py-huge text-center">
                <h3 className="text-[18px]">{t("reports.failedTitle")}</h3>
                <Button
                  variant="secondary"
                  onClick={() => void stats.refetch()}
                >
                  {t("common.retry")}
                </Button>
              </div>
            )}

            {stats.isPending && (
              <div
                aria-hidden
                className="grid gap-md sm:grid-cols-2 xl:grid-cols-4"
              >
                {[0, 1, 2, 3].map((one) => (
                  <div
                    key={one}
                    className="h-[76px] rounded-md border border-border bg-surface opacity-60"
                  />
                ))}
              </div>
            )}

            {stats.isSuccess && (
              <>
                <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
                  <Tile
                    label={t("reports.tileRevenue")}
                    value={
                      <Price value={stats.data.totals.revenue} code={code} />
                    }
                    change={change(
                      stats.data.totals.revenue,
                      prior.data?.totals.revenue,
                    )}
                  />
                  <Tile
                    label={t("reports.tileOrders")}
                    value={String(stats.data.totals.orders)}
                    change={change(
                      stats.data.totals.orders,
                      prior.data?.totals.orders,
                    )}
                  />
                  <Tile
                    label={t("reports.tileAverage")}
                    value={
                      <Price
                        value={stats.data.totals.averageOrder}
                        code={code}
                      />
                    }
                    change={change(
                      stats.data.totals.averageOrder,
                      prior.data?.totals.averageOrder,
                    )}
                  />
                  <Tile
                    label={t("reports.tileDelivery")}
                    value={
                      <Price
                        value={stats.data.totals.deliveryFees}
                        code={code}
                      />
                    }
                    change={change(
                      stats.data.totals.deliveryFees,
                      prior.data?.totals.deliveryFees,
                    )}
                  />
                </div>

                {/* Two figures that are not revenue and would be lost among
                    the tiles: what promotions cost, and what was cancelled. */}
                <p className="flex flex-wrap items-baseline gap-lg ps-md text-[13px] text-text-soft">
                  <span className="flex items-baseline gap-sm">
                    {t("reports.discountsGiven")}
                    <Price
                      value={stats.data.totals.discounts}
                      code={code}
                      className="text-[13px] font-semibold"
                    />
                  </span>
                  <span>
                    {t("reports.cancelled", {
                      count: stats.data.totals.cancelled,
                    })}
                  </span>
                </p>

                <div className="grid gap-xxl xl:grid-cols-[3fr_2fr]">
                  <Card title={t("reports.chartRevenue")}>
                    <BarChart
                      height={160}
                      // Money is `accent` — the palette's "going well" — and
                      // the tallest bar is drawn at full strength, so "our best
                      // day" is answered without comparing heights by eye.
                      tone="accent"
                      title={t("reports.chartRevenueAria")}
                      bars={stats.data.daily.map((day, index) => ({
                        key: day.day,
                        // Every third label, or thirty of them overlap into a
                        // grey smear that reads as noise.
                        label: index % 3 === 0 ? day.day.slice(8) : "",
                        value: day.revenue,
                        ghost: prior.data?.daily[index]?.revenue,
                        title: t("reports.chartRevenueTitle", {
                          day: day.day,
                          orders: day.orders,
                          amount: format(day.revenue, code),
                        }),
                      }))}
                    />
                    {prior.isSuccess && (
                      <p className="text-[12px] text-text-faint">
                        {t("reports.ghostNote")}
                      </p>
                    )}
                  </Card>

                  <Card title={t("reports.chartHours")}>
                    <HeatGrid
                      // A shape, not a verdict: `info` reads as information
                      // rather than as good or bad news about a Tuesday.
                      tone="info"
                      title={t("reports.chartHoursAria")}
                      dayLabels={WEEKDAYS}
                      values={hourlyGrid(stats.data.hourly)}
                    />
                  </Card>

                  <Card title={t("reports.chartItems")}>
                    {stats.data.topItems.length === 0 ? (
                      <Empty />
                    ) : (
                      <HBarList
                        // Volume, not money — `sun` keeps it visibly a
                        // different question from the two revenue charts.
                        tone="sun"
                        title={t("reports.chartItemsAria")}
                        rows={stats.data.topItems.map((item) => ({
                          key: item.menuItemId,
                          // jsonb, not text: `0054` made the line's name
                          // snapshot localised. Rendering the object directly
                          // is what React refuses.
                          label: pickLocalized(item.name),
                          value: item.quantity,
                          note: t("reports.sold", { count: item.quantity }),
                        }))}
                      />
                    )}
                  </Card>

                  <Card title={t("reports.chartStores")}>
                    {stats.data.topStores.length === 0 ? (
                      <Empty />
                    ) : (
                      <HBarList
                        // Money, so it wears the same colour as the revenue
                        // bars: two charts answering the same question in two
                        // colours would imply they were about different things.
                        tone="accent"
                        title={t("reports.chartStoresAria")}
                        rows={stats.data.topStores.map((store) => ({
                          key: store.storeId,
                          label: pickLocalized(store.name),
                          value: store.revenue,
                          note: format(store.revenue, code),
                        }))}
                      />
                    )}
                  </Card>

                  <Card title={t("reports.chartFunnel")}>
                    {stats.data.funnel.length === 0 ? (
                      <Empty />
                    ) : (
                      <HBarList
                        title={t("reports.chartFunnelAria")}
                        // The only chart where a colour per row is information:
                        // these bars *are* statuses, so each wears the colour it
                        // wears in the queue and on the tiles above. A funnel in
                        // one flat colour makes the reader match names to a
                        // legend they have to hold in their head.
                        rows={stats.data.funnel.map((step) => ({
                          key: step.slug,
                          label: statusNames.get(step.slug) ?? step.slug,
                          value: step.count,
                          note: String(step.count),
                          fill: statusTone(step.slug).dot,
                        }))}
                      />
                    )}
                  </Card>

                  <Card title={t("reports.chartBands")}>
                    {stats.data.deliveryBands.length === 0 ? (
                      <Empty />
                    ) : (
                      <HBarList
                        // The ladder is its own subject — neither revenue in
                        // general nor volume — so it gets its own colour.
                        tone="primary"
                        title={t("reports.chartBandsAria")}
                        rows={stats.data.deliveryBands.map((band) => ({
                          key: String(band.upToKm),
                          label: t("reports.bandLabel", { km: band.upToKm }),
                          value: band.revenue,
                          note: format(band.revenue, code),
                        }))}
                      />
                    )}
                  </Card>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Sunday-first, matching the stored index. Rotated for reading in `HeatGrid`. */
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * The sparse hourly buckets, filled into a full week × 24 grid.
 *
 * The server sends only what has orders in it — deliberately, since the empty
 * grid is cheaper to build here than to transmit. Filling it is what lets the
 * chart show *when nothing happens*, which is half the answer to "when do we
 * need staff".
 */
function hourlyGrid(hourly: Stats["hourly"]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const bucket of hourly) {
    const row = grid[bucket.dayOfWeek];
    if (row && bucket.hour >= 0 && bucket.hour < 24) {
      row[bucket.hour] = bucket.orders;
    }
  }
  return grid;
}

/**
 * The change against the previous period, as a rendered percentage.
 *
 * `undefined` while the comparison is still loading or missing — a tile shows
 * no change rather than a confident "+0%", which would be a claim.
 *
 * Growth from nothing is not a percentage. Going from zero orders to five is an
 * infinite increase by the arithmetic and means "we started", so it is named
 * rather than computed.
 */
function change(
  now: number,
  before: number | undefined,
): { text: string; up: boolean } | undefined {
  if (before === undefined) return undefined;
  if (before === 0) {
    if (now === 0) return undefined;
    return { text: t("reports.fromNothing"), up: true };
  }

  const percent = Math.round(((now - before) / before) * 100);
  if (percent === 0) return { text: t("reports.flat"), up: true };

  return {
    text: `${percent > 0 ? "+" : ""}${percent}%`,
    up: percent > 0,
  };
}

function Tile({
  label,
  value,
  change: delta,
}: {
  label: string;
  value: ReactNode;
  change?: { text: string; up: boolean };
}) {
  return (
    <div className="flex flex-col gap-xxs rounded-md border border-border bg-surface px-lg py-md">
      <span className="text-[12px] text-text-faint">{label}</span>
      <span className="text-[22px] font-semibold tabular-nums">{value}</span>
      {delta && (
        <span
          className={cx(
            "text-[12px] font-semibold",
            delta.up ? "text-accent-deep" : "text-danger",
          )}
        >
          {delta.text}
        </span>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-md rounded-md border border-border bg-surface p-lg">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Nothing to draw is a sentence, never an empty box that looks broken. */
function Empty() {
  return (
    <p className="rounded-md border border-dashed border-border px-lg py-xl text-center text-[13px] text-text-soft">
      {t("reports.nothingYet")}
    </p>
  );
}
