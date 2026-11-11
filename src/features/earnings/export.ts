"use client";

import {
  writeSheets,
  type ExportFormat,
  type Sheet,
} from "@/features/reports/export";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { formatMoney, type Currency } from "@/lib/money";

import type { CurrencyGroup } from "./api";

/**
 * The earnings report as a file — one sheet per currency, the rows and the
 * total the screen shows, in its order. Money as text beside the raw minor
 * units, for the reason `features/reports/export.ts` gives.
 */
function sheets(
  groups: readonly CurrencyGroup[],
  currencyOf: (code: string) => Currency | undefined,
): Sheet[] {
  return groups.map((group) => {
    const currency = currencyOf(group.currencyCode);
    const money = (minor: number) =>
      currency ? formatMoney(minor, currency) : String(minor);
    return {
      name: t("earningsReport.sheet", { code: group.currencyCode }),
      rows: [
        [
          t("earningsReport.colShop"),
          t("earningsReport.colBranch"),
          t("earningsReport.colModel"),
          t("earningsReport.colOrders"),
          t("earningsReport.colSales"),
          t("earningsReport.colEarned"),
          t("earningsReport.colPaid"),
          t("earningsReport.colDelivery"),
          t("earningsReport.colFreeDelivery"),
          t("earningsReport.colFreeCount"),
          t("earningsReport.colTotalEarned"),
          t("earningsReport.colSalesRaw"),
          t("earningsReport.colEarnedRaw"),
          t("earningsReport.colPaidRaw"),
          t("earningsReport.colDeliveryRaw"),
          t("earningsReport.colFreeDeliveryRaw"),
          t("earningsReport.colTotalEarnedRaw"),
        ],
        ...group.rows.map((row) => [
          pickLocalized(row.storeName),
          row.branchName ? pickLocalized(row.branchName) : "",
          t(`earnings.${row.model}`),
          row.orders,
          money(row.sales),
          money(row.earning),
          money(row.storeDue),
          money(row.delivery),
          money(row.deliveryWaived),
          row.freeDeliveries,
          money(row.earning + row.delivery),
          row.sales,
          row.earning,
          row.storeDue,
          row.delivery,
          row.deliveryWaived,
          row.earning + row.delivery,
        ]),
        [
          t("earningsReport.total"),
          "",
          "",
          group.totals.orders,
          money(group.totals.sales),
          money(group.totals.earning),
          money(group.totals.storeDue),
          money(group.totals.delivery),
          money(group.totals.deliveryWaived),
          group.totals.freeDeliveries,
          money(group.totals.earning + group.totals.delivery),
          group.totals.sales,
          group.totals.earning,
          group.totals.storeDue,
          group.totals.delivery,
          group.totals.deliveryWaived,
          group.totals.earning + group.totals.delivery,
        ],
      ],
    };
  });
}

export async function exportEarnings(
  format: ExportFormat,
  groups: readonly CurrencyGroup[],
  currencyOf: (code: string) => Currency | undefined,
  range: { from: string; to: string },
): Promise<void> {
  await writeSheets(format, sheets(groups, currencyOf), "earnings", range);
}
