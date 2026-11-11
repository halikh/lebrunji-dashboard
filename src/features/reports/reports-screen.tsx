"use client";

import {
  AlertCircle,
  ChevronDown,
  Download,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  Button,
  Card,
  EmptyState,
  Menu,
  Page,
  PageHeader,
  Section,
  Segmented,
  Skeleton,
  Stat,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  cx,
} from "@/components/ui";
import { BarChart, HBarList, HeatGrid } from "@/components/ui/chart";
import { DateRangeField } from "@/components/ui/date-field";
import { useToasts } from "@/components/ui/toast";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { statusName, statusTone } from "@/lib/order-status";
import {
  businessDate,
  formatBusinessDay,
  formatDate,
  formatMonthKey,
  fromWallClock,
} from "@/lib/time";

import type { EarningsRow } from "@/features/earnings/api";
import { useEarningsReport } from "@/features/earnings/use-earnings-report";
import {
  earnedByStore,
  earnedIn,
  earnedText,
  earnedTotals,
} from "@/features/earnings/summary";

import type { Stats } from "./api/stats";
import { exportReport, type ExportFormat } from "./export";
import {
  businessRange,
  customRange,
  previousOf,
  previousRange,
  useStats,
  yearBefore,
} from "./use-stats";

/**
 * How the business did over a period.
 *
 * "What needs me now" is the orders queue, unfiltered by date — an order
 * still waiting from Tuesday is not Tuesday's business. This screen answers
 * only the question that is useless without a period.
 *
 * ## The view lives in the URL
 *
 * `?days=30`, or `?from=&to=` for picked dates, plus `?compare=` and
 * `?metric=`, so a view can be linked, reloaded or sent — and "the last 30
 * days" stays a *relative* range that means something different tomorrow
 * while a picked range does not.
 *
 * ## Shaped after Stripe and Shopify Analytics
 *
 * - **"Compare with" is a choice**, as in Shopify: the period before, the same
 *   days last year (the honest one for a business with a Ramadan and a
 *   summer), or nothing.
 * - **Each tile says what it is compared with**: the pill (the owner's
 *   choice: coloured, with a trend arrow, on the card's bottom edge) and the
 *   old figure beside it, as Stripe does — a percentage alone hides whether
 *   "+50%" is 2 → 3 or 2,000 → 3,000.
 * - **One chart, the figure chosen**: revenue, orders or the average order.
 *   Delivery fees are not offered — the payload has no daily series for
 *   them, and a chart of zeros would be a claim.
 * - **Granularity follows the range**: past three months the bars are
 *   months, because 365 daily bars are a texture, not a chart.
 * - **Drill-down where a row is a thing**: a shop in the ranking opens the
 *   shop. Orders are not linked — the queue has no date filter, and "the
 *   orders behind this number" without one would be a different set.
 */

const PRESETS = ["7", "30", "90", "365"] as const;
type Preset = (typeof PRESETS)[number];

const COMPARES = ["previous", "year", "none"] as const;
type Compare = (typeof COMPARES)[number];

/** The figures with a daily series, so the ones the chart can draw. */
const METRICS = ["revenue", "orders", "average"] as const;
type Metric = (typeof METRICS)[number];

/** Past this many days a bar is a month. Three months of days still read. */
const MONTHLY_AFTER = 92;

/** What the report can be written as, in the order they are offered. */
const FORMATS: ExportFormat[] = ["csv", "xlsx"];

/** Sunday-first, matching the stored index. `HeatGrid` rotates for reading. */
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function ReportsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const from = params.get("from");
  const to = params.get("to");
  const picked = Boolean(from && to);

  const requested = params.get("days");
  const days: Preset = PRESETS.includes(requested as Preset)
    ? (requested as Preset)
    : "30";

  const requestedCompare = params.get("compare");
  const compare: Compare = COMPARES.includes(requestedCompare as Compare)
    ? (requestedCompare as Compare)
    : "previous";

  const requestedMetric = params.get("metric");
  const metric: Metric = METRICS.includes(requestedMetric as Metric)
    ? (requestedMetric as Metric)
    : "revenue";

  const current = picked
    ? customRange(from as string, to as string)
    : businessRange(Number(days));
  const before =
    compare === "year"
      ? yearBefore(current.from, current.to)
      : picked
        ? previousOf(current.from, current.to)
        : previousRange(Number(days));

  const { format, currencies } = useMoney();
  const wantedCurrency = params.get("currency");
  const stats = useStats(current.from, current.to, true, wantedCurrency);
  /**
   * The currency every money figure here is in. One at a time (`0270`): minor
   * units of two currencies do not add up to anything. Asked for in the URL,
   * or the function's own choice, which is the window's busiest.
   */
  const code =
    stats.data?.currency ?? wantedCurrency ?? currencies?.[0]?.code ?? "";
  const prior = useStats(
    before.from,
    before.to,
    compare !== "none" && code !== "",
    code || null,
  );
  /**
   * The comparison, only when it is the one asked for. A placeholder holds
   * the *previous* key's figures — last year's while switching to "previous
   * period", or anything at all after "No comparison" — and a pill computed
   * from it would be a confident wrong answer.
   */
  const priorData =
    compare !== "none" && !prior.isPlaceholderData ? prior.data : undefined;

  // What we earned (`0262`), from the Earnings feature's reader, for the
  // same range and the same comparison. Commission and markup together.
  const earnings = useEarningsReport(current.from, current.to);
  const priorEarnings = useEarningsReport(
    before.from,
    before.to,
    compare !== "none",
  );
  // Only the report's currency, like every other figure here: with LBP picked
  // the page says lira, with USD dollars — never both side by side.
  const inCode = (rows: readonly EarningsRow[] | undefined) =>
    (rows ?? []).filter((row) => row.currencyCode === code);
  const earnedRows = inCode(earnings.data);
  const earnedNow = earnedTotals(earnedRows);
  const earnedBefore =
    compare !== "none" && !priorEarnings.isPlaceholderData && priorEarnings.data
      ? earnedTotals(inCode(priorEarnings.data))
      : undefined;
  const earnedPerStore = earnedByStore(earnedRows);
  /** The Earnings page, at this range — it reads the same `days` / `from` / `to`. */
  const earningsHref = (() => {
    const query = new URLSearchParams();
    if (picked) {
      query.set("from", from as string);
      query.set("to", to as string);
    } else if (days !== "30") {
      query.set("days", days);
    }
    const search = query.toString();
    return search ? `/earnings?${search}` : "/earnings";
  })();

  const toast = useToasts();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  /** The window's currencies, and the one on screen even if it holds nothing. */
  const currencyChoices = [
    ...new Set([
      ...(stats.data?.currencies ?? []).map((one) => one.code),
      ...(code ? [code] : []),
    ]),
  ];

  /** The last day *in* the half-open range, which is the day before `to`. */
  const lastDay = new Date(current.to.getTime() - 1);
  const beforeLastDay = new Date(before.to.getTime() - 1);

  function replace(query: URLSearchParams) {
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  /** A preset. Clears any picked dates — the two cannot both be in force. */
  function showPreset(next: Preset) {
    const query = new URLSearchParams(params);
    query.delete("from");
    query.delete("to");
    if (next === "30") query.delete("days");
    else query.set("days", next);
    replace(query);
  }

  /**
   * A picked range, whole or half. The half-state is written rather than
   * swallowed: the screen keeps showing the preset until both ends exist, so
   * nothing queries a range with one end missing and the charts do not blank
   * mid-choice. Clearing the control sends two nulls.
   */
  function pick(start: string | null, end: string | null) {
    const query = new URLSearchParams(params);
    for (const [key, value] of [
      ["from", start],
      ["to", end],
    ] as const) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    if (query.get("from") && query.get("to")) query.delete("days");
    replace(query);
  }

  /** One view parameter, deleted at its default so a plain link stays plain. */
  function setParam(
    key: "compare" | "metric" | "currency",
    value: string,
    fallback: string,
  ) {
    const query = new URLSearchParams(params);
    if (value === fallback) query.delete(key);
    else query.set(key, value);
    replace(query);
  }

  /**
   * Builds and hands over a file. The dates in the filename are the
   * *inclusive* range the screen shows, not the half-open one the query used.
   */
  async function run(option: ExportFormat) {
    if (!stats.data) return;
    setExporting(option);
    try {
      await exportReport(
        option,
        stats.data,
        currencies?.find((one) => one.code === code),
        { from: toDayKey(current.from), to: toDayKey(lastDay) },
        {
          rows: earnedRows,
          currencyOf: (one) => currencies?.find((c) => c.code === one),
        },
      );
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    } finally {
      setExporting(null);
    }
  }

  const data = stats.data;

  return (
    <Page>
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
        actions={
          // Disabled until the figures are in — a spreadsheet built from a
          // half-loaded report looks like an answer and is not one.
          <Menu
            label={t("reports.exportChoose")}
            items={FORMATS.map((option) => ({
              label: t(`reports.export.${option}` as const),
              onSelect: () => void run(option),
            }))}
            trigger={
              <Button
                variant="secondary"
                disabled={!stats.isSuccess || exporting !== null}
                pending={exporting !== null}
              >
                {exporting === null && <Download />}
                {exporting ? t("reports.exporting") : t("reports.exportLabel")}
                <ChevronDown className="text-ink-4" />
              </Button>
            }
          />
        }
      />

      {/* The range, what it is compared with, and both said in dates. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            items={PRESETS.map((key) => ({
              key,
              label: t(`reports.range${key}` as const),
            }))}
            // No preset is lit while picked dates are in force.
            value={picked ? ("" as Preset) : days}
            onChange={showPreset}
          />
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <DateRangeField
              from={from}
              to={to}
              onChange={pick}
              aria-label={t("reports.rangeLabel")}
              className="sm:w-[280px]"
              // The line under the controls already says "Beirut time".
              hideZone
            />
            {picked && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => showPreset("30")}
              >
                {t("reports.rangeClear")}
              </Button>
            )}
          </div>
          {currencyChoices.length > 1 && (
            <Segmented
              className="sm:ms-auto"
              items={currencyChoices.map((one) => ({ key: one, label: one }))}
              value={code}
              onChange={(next) => setParam("currency", next, "")}
            />
          )}
        </div>
        <p className="text-[12.5px] text-ink-3">
          {compare === "none"
            ? t("reports.rangeNote", {
                from: formatBusinessDay(current.from),
                to: formatBusinessDay(lastDay),
              })
            : t("reports.rangeNoteCompared", {
                from: formatBusinessDay(current.from),
                to: formatBusinessDay(lastDay),
                beforeFrom: formatBusinessDay(before.from),
                beforeTo: formatBusinessDay(beforeLastDay),
              })}
        </p>
      </div>

      {stats.isError && (
        <Card padded={false}>
          <EmptyState
            icon={<AlertCircle />}
            title={t("reports.failedTitle")}
            description={
              stats.error instanceof Error ? stats.error.message : undefined
            }
            action={
              <Button onClick={() => void stats.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        </Card>
      )}

      {stats.isPending && (
        <div aria-busy className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((one) => (
              <Skeleton key={one} className="h-[108px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
      )}

      {data && (
        <div
          className={cx(
            "flex flex-col gap-6 transition-opacity",
            // A new range is loading over the old figures.
            stats.isPlaceholderData && "opacity-60",
          )}
        >
          {/* No `shopRate` on any figure: these are sums across shops, and
              include the platform's own money — a total read at one shop's
              rate would be a number in no shop's currency. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <Tile
              label={t("reports.tileRevenue")}
              value={<Money value={data.totals.revenue} code={code} />}
              change={change(data.totals.revenue, priorData?.totals.revenue)}
              was={priorData && format(priorData.totals.revenue, code)}
            />
            <EarnedTile
              now={earnedNow}
              before={earnedBefore}
              fallbackCode={code}
              href={earningsHref}
              loading={earnings.isPending}
            />
            <Tile
              label={t("reports.tileOrders")}
              value={String(data.totals.orders)}
              change={change(data.totals.orders, priorData?.totals.orders)}
              was={priorData && String(priorData.totals.orders)}
            />
            <Tile
              label={t("reports.tileAverage")}
              value={<Money value={data.totals.averageOrder} code={code} />}
              change={change(
                data.totals.averageOrder,
                priorData?.totals.averageOrder,
              )}
              was={priorData && format(priorData.totals.averageOrder, code)}
            />
            <Tile
              label={t("reports.tileDelivery")}
              value={<Money value={data.totals.deliveryFees} code={code} />}
              change={change(
                data.totals.deliveryFees,
                priorData?.totals.deliveryFees,
              )}
              was={priorData && format(priorData.totals.deliveryFees, code)}
            />
          </div>

          <TrendChart
            metric={metric}
            onMetric={(next) => setParam("metric", next, "revenue")}
            daily={data.daily}
            before={priorData?.daily}
            compare={compare}
            money={(minor) => format(minor, code)}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              title={t("reports.chartStores")}
              description={
                data.topStores.length > 0 ? t("reports.storesHint") : undefined
              }
              bodyClassName="p-0"
            >
              {data.topStores.length === 0 ? (
                <Empty />
              ) : (
                <RankTable
                  nameHeader={t("reports.colStore")}
                  countHeader={t("reports.colOrders")}
                  rows={data.topStores.map((store) => ({
                    key: store.storeId,
                    // Drill-down: the row is a shop, and the shop is one
                    // click away — as in Shopify's report tables.
                    href: `/shops/${store.storeId}`,
                    name: pickLocalized(store.name),
                    count: store.orders,
                    revenue: store.revenue,
                    // Matched by shop; "—" for one that earned nothing here.
                    earned: earnedText(
                      earnedPerStore.get(store.storeId),
                      format,
                    ),
                  }))}
                  money={(minor) => format(minor, code)}
                  earnedHeader={t("reports.earnedColumn")}
                />
              )}
            </Section>

            <Section title={t("reports.chartItems")} bodyClassName="p-0">
              {data.topItems.length === 0 ? (
                <Empty />
              ) : (
                <RankTable
                  nameHeader={t("reports.colItem")}
                  countHeader={t("reports.colQuantity")}
                  // Not linked: the payload names the dish but not its shop,
                  // and a dish's page lives under its shop.
                  rows={data.topItems.map((item) => ({
                    key: item.menuItemId,
                    // jsonb, not text: `0054` localised the line's snapshot.
                    name: pickLocalized(item.name),
                    count: item.quantity,
                    revenue: item.revenue,
                  }))}
                  money={(minor) => format(minor, code)}
                />
              )}
            </Section>
          </div>

          <Section
            title={t("reports.chartHours")}
            description={t("reports.chartHoursAria")}
          >
            <div className="overflow-x-auto scrollbar-thin">
              <HeatGrid
                className="min-w-[520px]"
                tone="info"
                title={t("reports.chartHoursAria")}
                dayLabels={WEEKDAYS}
                values={hourlyGrid(data.hourly)}
              />
            </div>
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t("reports.chartFunnel")}>
              {data.funnel.length === 0 ? (
                <Empty />
              ) : (
                <HBarList
                  title={t("reports.chartFunnelAria")}
                  // The one chart where a colour per row is information: these
                  // bars *are* statuses, so each wears its queue colour.
                  rows={data.funnel.map((step) => ({
                    key: step.slug,
                    label: statusName(step.slug),
                    value: step.count,
                    note: String(step.count),
                    fill: statusTone(step.slug).dot,
                  }))}
                />
              )}
            </Section>

            <Section title={t("reports.chartBands")}>
              {data.deliveryBands.length === 0 ? (
                <Empty />
              ) : (
                <HBarList
                  tone="info"
                  title={t("reports.chartBandsAria")}
                  rows={data.deliveryBands.map((band) => ({
                    key: String(band.upToKm),
                    label: t("reports.bandLabel", { km: band.upToKm }),
                    value: band.revenue,
                    note: format(band.revenue, code),
                  }))}
                />
              )}
            </Section>
          </div>
        </div>
      )}
    </Page>
  );
}

/**
 * What we earned over the range — commission and markup as one figure, one
 * line per currency and never added across them. Compared like the others,
 * when the range is in one currency: two currencies have no single change.
 * It opens the Earnings page at the same range, for the breakdown.
 */
function EarnedTile({
  now,
  before,
  fallbackCode,
  href,
  loading,
}: {
  now: ReturnType<typeof earnedTotals>;
  before: ReturnType<typeof earnedTotals> | undefined;
  /** The report's currency, for a range that earned nothing. */
  fallbackCode: string;
  href: string;
  loading: boolean;
}) {
  const { format } = useMoney();
  const lines =
    now.length > 0 ? now : [{ currencyCode: fallbackCode, amount: 0 }];
  const only = lines.length === 1 ? lines[0] : undefined;
  const value = loading ? (
    <Skeleton className="h-7 w-24" />
  ) : (
    <span className="flex flex-col">
      {lines.map((one) => (
        <Money
          key={one.currencyCode}
          value={one.amount}
          code={one.currencyCode}
        />
      ))}
    </span>
  );
  return (
    <Tile
      label={t("reports.earned")}
      value={value}
      caption={
        <Link
          href={href}
          className="text-[12.5px] text-ink-3 hover:text-accent-ink hover:underline"
        >
          {t("reports.earnedHint")}
        </Link>
      }
      change={
        only && before && !loading
          ? change(only.amount, earnedIn(before, only.currencyCode))
          : undefined
      }
      was={
        only && before && !loading
          ? format(earnedIn(before, only.currencyCode), only.currencyCode)
          : undefined
      }
    />
  );
}

function Tile({
  label,
  value,
  change: delta,
  was,
  caption,
}: {
  label: string;
  value: ReactNode;
  /** A line under the figure — a hint, or a way to its breakdown. */
  caption?: ReactNode;
  change?: { text: string; up: boolean | null };
  /** The comparison period's figure, already formatted. */
  was?: string;
}) {
  // A flex column, so the change pill sits on the card's bottom edge and
  // lines up across tiles whether or not a tile has a second currency line.
  return (
    <Card className="flex min-w-0 flex-col">
      <Stat label={label} value={value} />
      {caption && <div className="mt-1.5">{caption}</div>}
      {delta && (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <span
            className={cx(
              "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12.5px] font-semibold tabular-nums",
              delta.up === true && "bg-success-soft text-success-ink",
              delta.up === false && "bg-danger-soft text-danger-ink",
              delta.up === null && "bg-hover text-ink-2",
            )}
          >
            {delta.up === true && <TrendingUp className="size-3.5" />}
            {delta.up === false && <TrendingDown className="size-3.5" />}
            {delta.up === null && <Minus className="size-3.5" />}
            {delta.text}
          </span>
          {/* The old figure, not just the ratio — Stripe's "from $3,900". */}
          <span className="min-w-0 text-[12.5px] text-ink-4 tabular-nums">
            {was ? t("reports.was", { value: was }) : t("reports.vsBefore")}
          </span>
        </div>
      )}
    </Card>
  );
}

/**
 * The trend, one figure at a time — Stripe's "pick the metric, keep the
 * chart". The comparison is ghosted behind each bar and named in its
 * tooltip, so a bar answers "and what was it then" without a second chart.
 * Buckets are paired by position, day 1 with day 1, as both products do.
 */
function TrendChart({
  metric,
  onMetric,
  daily,
  before,
  compare,
  money,
}: {
  metric: Metric;
  onMetric: (metric: Metric) => void;
  daily: Stats["daily"];
  before: Stats["daily"] | undefined;
  compare: Compare;
  money: (minor: number) => string;
}) {
  const monthly = daily.length > MONTHLY_AFTER;
  const now = bucketsOf(daily, monthly);
  const then = before ? bucketsOf(before, monthly) : undefined;
  const stride = labelStride(now.length);
  const show = (value: number) =>
    metric === "orders" ? String(value) : money(value);
  const name = t(`reports.metric.${metric}` as const);

  return (
    <Section
      title={t(monthly ? "reports.chartByMonth" : "reports.chartByDay", {
        metric: name,
      })}
      description={
        then
          ? t(
              compare === "year"
                ? "reports.ghostNoteYear"
                : "reports.ghostNote",
            )
          : undefined
      }
      actions={
        <Segmented
          size="sm"
          items={METRICS.map((key) => ({
            key,
            label: t(`reports.metric.${key}` as const),
          }))}
          value={metric}
          onChange={onMetric}
        />
      }
    >
      <BarChart
        height={180}
        tone="accent"
        title={t("reports.chartAria", { metric: name })}
        bars={now.map((bucket, index) => {
          const value = valueOf(bucket, metric);
          const earlier = then?.[index];
          const ghost = earlier ? valueOf(earlier, metric) : undefined;
          return {
            key: bucket.key,
            label: index % stride === 0 ? bucket.label : "",
            value,
            ghost,
            title:
              ghost === undefined
                ? t("reports.chartBar", {
                    when: bucket.when,
                    value: show(value),
                  })
                : t("reports.chartBarCompared", {
                    when: bucket.when,
                    value: show(value),
                    before: show(ghost),
                  }),
          };
        })}
      />
    </Section>
  );
}

/** A ranked table: name with a share bar under it, a count, the money. */
function RankTable({
  nameHeader,
  countHeader,
  rows,
  money,
  earnedHeader,
}: {
  nameHeader: string;
  countHeader: string;
  /** Adds the "Earned" column, read from each row's `earned`. */
  earnedHeader?: string;
  rows: {
    key: string;
    /** Where the row's thing is opened, when it has a page. */
    href?: string;
    name: string;
    count: number;
    revenue: number;
    /** What we earned on it, formatted — or "—". */
    earned?: string;
  }[];
  money: (minor: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.revenue));
  return (
    <Table>
      <THead>
        <tr>
          <Th className="w-10 pe-0">
            <span className="sr-only">{t("reports.colRank")}</span>
          </Th>
          <Th>{nameHeader}</Th>
          <Th className="text-end">{countHeader}</Th>
          <Th className="text-end">{t("reports.colRevenue")}</Th>
          {earnedHeader && <Th className="text-end">{earnedHeader}</Th>}
        </tr>
      </THead>
      <TBody>
        {rows.map((row, index) => (
          <Tr key={row.key}>
            <Td className="pe-0 text-[12.5px] text-ink-4 tabular-nums">
              {index + 1}
            </Td>
            <Td className="max-w-0 py-2.5">
              <div className="flex min-w-0 flex-col gap-1.5">
                {row.href ? (
                  <Link
                    href={row.href}
                    className="truncate font-medium text-ink hover:text-accent-ink hover:underline"
                  >
                    {row.name}
                  </Link>
                ) : (
                  <span className="truncate font-medium">{row.name}</span>
                )}
                <span aria-hidden className="block h-1 rounded-full bg-hover">
                  <span
                    className="block h-full rounded-full bg-accent/70"
                    style={{ width: `${(row.revenue / max) * 100}%` }}
                  />
                </span>
              </div>
            </Td>
            <Td className="text-end tabular-nums">{row.count}</Td>
            <Td className="text-end tabular-nums font-medium whitespace-nowrap">
              {money(row.revenue)}
            </Td>
            {earnedHeader && (
              <Td className="text-end tabular-nums whitespace-nowrap text-ink-2">
                {row.earned}
              </Td>
            )}
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

/** Nothing to draw is a sentence, never an empty box that looks broken. */
function Empty() {
  return (
    <p className="px-5 py-8 text-center text-[13.5px] text-ink-3">
      {t("reports.nothingYet")}
    </p>
  );
}

/**
 * A Beirut trading day as `YYYY-MM-DD`, for filenames. Not
 * `toISOString().slice(0, 10)`, which is UTC's day.
 */
function toDayKey(instant: Date): string {
  const day = businessDate(instant);
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

/** The sparse hourly buckets, filled into a full week × 24 grid. */
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
 * The change against the comparison period. `undefined` while it is loading
 * — no change rather than a confident "+0%", which would be a claim. Growth
 * from nothing is named rather than computed: it is infinite by the
 * arithmetic and means "we started".
 */
function change(
  now: number,
  before: number | undefined,
): { text: string; up: boolean | null } | undefined {
  if (before === undefined) return undefined;
  if (before === 0) {
    if (now === 0) return undefined;
    return { text: t("reports.fromNothing"), up: true };
  }
  const percent = Math.round(((now - before) / before) * 100);
  if (percent === 0) return { text: t("reports.flat"), up: null };
  return { text: `${percent > 0 ? "+" : ""}${percent}%`, up: percent > 0 };
}

/** Every how-many-th bar carries a label, so a range gets about ten. */
function labelStride(count: number) {
  return Math.max(1, Math.ceil(count / 10));
}

type Bucket = {
  key: string;
  /** Under the bar: a day of the month, or a month. */
  label: string;
  /** In the tooltip: the whole date, or the month. */
  when: string;
  revenue: number;
  orders: number;
};

/**
 * Days, or months once the range is long. Months are summed from the days
 * the server cut in Beirut time, so a month bar is exactly what its days add
 * up to.
 */
function bucketsOf(daily: Stats["daily"], monthly: boolean): Bucket[] {
  if (!monthly) {
    return daily.map((day) => ({
      key: day.day,
      label: day.day.slice(8),
      when: dayName(day.day),
      revenue: day.revenue,
      orders: day.orders,
    }));
  }
  const months = new Map<string, Bucket>();
  for (const day of daily) {
    const key = day.day.slice(0, 7);
    const month = months.get(key) ?? {
      key,
      label: formatMonthKey(key),
      when: formatMonthKey(key),
      revenue: 0,
      orders: 0,
    };
    month.revenue += day.revenue;
    month.orders += day.orders;
    months.set(key, month);
  }
  return [...months.values()];
}

/** `2026-11-03` as a date, read at noon so no offset can move it a day. */
function dayName(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return formatDate(fromWallClock({ year, month, day, hour: 12 }));
}

/**
 * The average per bucket is that bucket's revenue over its orders — the
 * same division the tile does — not an average of averages.
 */
function valueOf(bucket: Bucket, metric: Metric): number {
  if (metric === "revenue") return bucket.revenue;
  if (metric === "orders") return bucket.orders;
  return bucket.orders > 0 ? Math.round(bucket.revenue / bucket.orders) : 0;
}

/**
 * One figure in the report's currency, and only that — no converted second
 * line under it. With LBP picked the page reads lira, with USD dollars.
 */
function Money({ value, code }: { value: number; code: string }) {
  const { format } = useMoney();
  return <span className="tabular-nums">{format(value, code)}</span>;
}
