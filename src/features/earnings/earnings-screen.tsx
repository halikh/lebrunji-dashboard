"use client";

import { AlertCircle, ChevronDown, Download, HandCoins } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

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
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  cx,
} from "@/components/ui";
import { DateRangeField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import { useToasts } from "@/components/ui/toast";
import { useMoney } from "@/features/reference/use-currencies";
import type { ExportFormat } from "@/features/reports/export";
import { businessRange, customRange } from "@/features/reports/use-stats";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { businessDate, formatBusinessDay } from "@/lib/time";

import { groupByCurrency, type CurrencyGroup, type EarningsRow } from "./api";
import { exportEarnings } from "./export";
import { useEarningsReport } from "./use-earnings-report";

/**
 * What the platform earned from its shops over a period (`0262`), and what
 * the drivers handed the shops at pickup.
 *
 * The range works as the Reports screen's does — a preset or two picked
 * dates, in the URL — so a link to "last month's earnings" stays one. One
 * table per currency, never one total across them: dollars and lira do not
 * add. A row is one shop's part of an order, so an order from two shops is
 * counted once for each, and the column says "Shop orders". Orders from before
 * commission and markup existed are here too (`0273`), at no rate.
 */

const PRESETS = ["7", "30", "90", "365"] as const;
type Preset = (typeof PRESETS)[number];

const FORMATS: ExportFormat[] = ["csv", "xlsx"];

/** All, or one way of earning: what the filter can be set to. */
const MODEL_FILTERS = ["all", "commission", "markup"] as const;
type ModelFilter = (typeof MODEL_FILTERS)[number];

export function EarningsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToasts();
  const { format, currencies } = useMoney();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const from = params.get("from");
  const to = params.get("to");
  const picked = Boolean(from && to);
  const requested = params.get("days");
  const days: Preset = PRESETS.includes(requested as Preset)
    ? (requested as Preset)
    : "30";

  const current = picked
    ? customRange(from as string, to as string)
    : businessRange(Number(days));
  /** The last day *in* the half-open range. */
  const lastDay = new Date(current.to.getTime() - 1);

  // Which way of earning to show (user, 2026-11-08). In the URL with the
  // range, so a reload or a shared link keeps it; the export follows it.
  const requestedModel = params.get("model");
  const model: ModelFilter = MODEL_FILTERS.includes(
    requestedModel as ModelFilter,
  )
    ? (requestedModel as ModelFilter)
    : "all";

  // And one shop, or all of them. The choices are the shops with orders in
  // the range, so the list never offers one that would come back empty.
  const shop = params.get("shop") ?? "";

  const report = useEarningsReport(current.from, current.to);
  const shopOptions = [
    ...new Map(
      (report.data ?? []).map((row) => [
        row.storeId,
        { value: row.storeId, label: pickLocalized(row.storeName) },
      ]),
    ).values(),
  ].sort((a, b) => a.label.localeCompare(b.label));
  const groups = groupByCurrency(
    (report.data ?? []).filter(
      (row) =>
        (model === "all" || row.model === model) &&
        (shop === "" || row.storeId === shop),
    ),
  );
  const currencyOf = (code: string) =>
    currencies?.find((one) => one.code === code);

  function replace(query: URLSearchParams) {
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  function showPreset(next: Preset) {
    const query = new URLSearchParams(params);
    query.delete("from");
    query.delete("to");
    if (next === "30") query.delete("days");
    else query.set("days", next);
    replace(query);
  }

  function showModel(next: ModelFilter) {
    const query = new URLSearchParams(params);
    if (next === "all") query.delete("model");
    else query.set("model", next);
    replace(query);
  }

  function showShop(next: string) {
    const query = new URLSearchParams(params);
    if (next) query.set("shop", next);
    else query.delete("shop");
    replace(query);
  }

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

  async function run(option: ExportFormat) {
    if (!report.data) return;
    setExporting(option);
    try {
      await exportEarnings(option, groups, currencyOf, {
        from: dayKey(current.from),
        to: dayKey(lastDay),
      });
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <Page>
      <PageHeader
        title={t("earningsReport.title")}
        description={t("earningsReport.description")}
        actions={
          <Menu
            label={t("reports.exportChoose")}
            items={FORMATS.map((option) => ({
              label: t(`reports.export.${option}` as const),
              onSelect: () => void run(option),
            }))}
            trigger={
              <Button
                variant="secondary"
                disabled={
                  !report.isSuccess || groups.length === 0 || exporting !== null
                }
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

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            items={PRESETS.map((key) => ({
              key,
              label: t(`reports.range${key}` as const),
            }))}
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
          <Segmented
            items={MODEL_FILTERS.map((key) => ({
              key,
              label: t(`earningsReport.filter.${key}` as const),
            }))}
            value={model}
            onChange={showModel}
          />
          <Select
            value={shop}
            onChange={showShop}
            options={shopOptions}
            placeholder={t("earningsReport.allShops")}
            isClearable
            aria-label={t("earningsReport.shopFilter")}
            className="w-full sm:w-64"
          />
        </div>
        <p className="text-[12.5px] text-ink-3">
          {t("reports.rangeNote", {
            from: formatBusinessDay(current.from),
            to: formatBusinessDay(lastDay),
          })}
        </p>
      </div>

      {report.isError && (
        <Card padded={false}>
          <EmptyState
            icon={<AlertCircle />}
            title={t("earningsReport.failed")}
            description={
              report.error instanceof Error ? report.error.message : undefined
            }
            action={
              <Button onClick={() => void report.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        </Card>
      )}

      {report.isPending && (
        <div aria-busy className="flex flex-col gap-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      )}

      {report.isSuccess && groups.length === 0 && (
        <Card padded={false}>
          <EmptyState
            icon={<HandCoins />}
            title={
              model === "all"
                ? t("earningsReport.emptyTitle")
                : t(`earningsReport.emptyFiltered.${model}` as const)
            }
            description={t("earningsReport.emptyBody")}
            action={
              <Link
                href="/shops"
                className="text-[13.5px] font-medium text-accent hover:underline"
              >
                {t("earningsReport.toShops")}
              </Link>
            }
          />
        </Card>
      )}

      {report.isSuccess && groups.length > 0 && (
        <div
          className={cx(
            "flex flex-col gap-6 transition-opacity",
            report.isPlaceholderData && "opacity-60",
          )}
        >
          {groups.map((group) => (
            <CurrencyTable
              key={group.currencyCode}
              group={group}
              money={(minor) => format(minor, group.currencyCode)}
            />
          ))}
          <p className="text-[12.5px] text-ink-3">{t("earningsReport.note")}</p>
        </div>
      )}
    </Page>
  );
}

/** One currency: its totals, then a row per shop and branch. */
function CurrencyTable({
  group,
  money,
}: {
  group: CurrencyGroup;
  money: (minor: number) => string;
}) {
  return (
    <Section
      title={t("earningsReport.currencyTitle", { code: group.currencyCode })}
      description={t("earningsReport.currencySummary", {
        earned: money(group.totals.earning),
        paid: money(group.totals.storeDue),
        delivery: money(group.totals.delivery),
        orders: group.totals.orders,
      })}
      bodyClassName="p-0"
    >
      <Table>
        <THead>
          <Tr>
            <Th>{t("earningsReport.colShop")}</Th>
            <Th>{t("earningsReport.colModel")}</Th>
            <Th align="end">{t("earningsReport.colOrders")}</Th>
            <Th align="end">{t("earningsReport.colSales")}</Th>
            <Th align="end">{t("earningsReport.colEarned")}</Th>
            <Th align="end">{t("earningsReport.colPaid")}</Th>
            <Th align="end">{t("earningsReport.colDelivery")}</Th>
            <Th align="end">{t("earningsReport.colTotalEarned")}</Th>
          </Tr>
        </THead>
        <TBody>
          {group.rows.map((row) => (
            <Tr key={rowKey(row)}>
              <Td>
                <span className="flex min-w-0 flex-col">
                  <Link
                    href={`/shops/${row.storeId}`}
                    className="truncate font-medium text-ink hover:underline"
                  >
                    {pickLocalized(row.storeName)}
                  </Link>
                  {row.branchName &&
                    pickLocalized(row.branchName) !==
                      pickLocalized(row.storeName) && (
                      <span className="truncate text-[12.5px] text-ink-3">
                        {pickLocalized(row.branchName)}
                      </span>
                    )}
                  {row.branchAddress && pickLocalized(row.branchAddress) && (
                    <span className="truncate text-[12.5px] text-ink-3">
                      {pickLocalized(row.branchAddress)}
                    </span>
                  )}
                </span>
              </Td>
              <Td className="whitespace-nowrap text-ink-2">
                {t(`earnings.${row.model}`)}
              </Td>
              <Td className="text-end tabular-nums">{row.orders}</Td>
              <Td className="text-end whitespace-nowrap tabular-nums">
                {money(row.sales)}
              </Td>
              <Td className="text-end whitespace-nowrap tabular-nums">
                {money(row.earning)}
              </Td>
              <Td className="text-end whitespace-nowrap tabular-nums">
                {money(row.storeDue)}
              </Td>
              <Td className="text-end whitespace-nowrap tabular-nums">
                {money(row.delivery)}
              </Td>
              <Td className="text-end whitespace-nowrap tabular-nums">
                <span className="inline-flex rounded-md bg-success-soft px-2 py-0.5 font-semibold text-success-ink ring-1 ring-success/25 ring-inset">
                  {money(row.earning + row.delivery)}
                </span>
              </Td>
            </Tr>
          ))}
          <Tr className="bg-subtle font-semibold">
            <Td>{t("earningsReport.total")}</Td>
            <Td />
            <Td className="text-end tabular-nums">{group.totals.orders}</Td>
            <Td className="text-end whitespace-nowrap tabular-nums">
              {money(group.totals.sales)}
            </Td>
            <Td className="text-end whitespace-nowrap tabular-nums">
              {money(group.totals.earning)}
            </Td>
            <Td className="text-end whitespace-nowrap tabular-nums">
              {money(group.totals.storeDue)}
            </Td>
            <Td className="text-end whitespace-nowrap tabular-nums">
              {money(group.totals.delivery)}
            </Td>
            <Td className="text-end whitespace-nowrap tabular-nums">
              <span className="inline-flex rounded-md bg-success-ink px-2 py-0.5 font-bold text-white shadow-xs">
                {money(group.totals.earning + group.totals.delivery)}
              </span>
            </Td>
          </Tr>
        </TBody>
      </Table>
    </Section>
  );
}

function rowKey(row: EarningsRow): string {
  return [row.storeId, row.branchId ?? "", row.model, row.currencyCode].join(
    "|",
  );
}

/** `YYYY-MM-DD` of a Beirut day, for the file's name. */
function dayKey(instant: Date): string {
  const day = businessDate(instant);
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}
