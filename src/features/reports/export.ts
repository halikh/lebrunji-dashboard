"use client";

import { download, reportFilename, toCsv } from "@/lib/download";
import { t } from "@/i18n/translations";
import { formatMoney, type Currency } from "@/lib/money";

import type { EarningsRow } from "@/features/earnings/api";
import {
  earnedByStore,
  earnedText,
  earnedTotals,
} from "@/features/earnings/summary";

import type { Stats } from "./api/stats";

/** What we earned over the same range, and how to say each currency. */
export type EarnedForExport = {
  rows: readonly EarningsRow[];
  currencyOf: (code: string) => Currency | undefined;
};

/**
 * The overview, as a file.
 *
 * ## What is exported is what is on screen
 *
 * Every sheet below is one of the blocks the report draws, with the same
 * figures and the same order. An export that quietly held more than the screen
 * — or less — is one nobody can check, and the first thing anybody does with a
 * spreadsheet is compare a number in it against the page it came from.
 *
 * ## Money is written as text, deliberately
 *
 * The stored figure is minor units, and a spreadsheet given `600` will happily
 * total it as six hundred. Writing `$6.00` costs the ability to sum a column
 * and buys the guarantee that nobody reads a hundredfold error as a fact —
 * and a report whose totals are already computed is not a spreadsheet somebody
 * needs to re-sum.
 *
 * The raw minor-unit figure rides along in its own column for anyone who does
 * want to compute, labelled so it cannot be mistaken for the amount.
 */

export type ExportFormat = "csv" | "xlsx";

export type Sheet = { name: string; rows: (string | number)[][] };

/**
 * The report as a set of named tables.
 *
 * Built once and handed to whichever writer was asked for, so the three formats
 * cannot disagree about what the report contains — which they would within a
 * week if each assembled its own.
 */
function sheets(
  stats: Stats,
  currency: Currency | undefined,
  earned: EarnedForExport | undefined,
): Sheet[] {
  const money = (minor: number) =>
    currency ? formatMoney(minor, currency) : String(minor);
  const moneyIn = (minor: number, code: string) => {
    const of = earned?.currencyOf(code);
    return of ? formatMoney(minor, of) : `${minor} ${code}`;
  };
  // One summary row per currency, never added across them (`0262`).
  const totals = earnedTotals(earned?.rows ?? []);
  const perStore = earnedByStore(earned?.rows ?? []);

  return [
    {
      name: t("reports.sheetSummary"),
      rows: [
        [t("reports.colMetric"), t("reports.colValue"), t("reports.colRaw")],
        [
          t("reports.tileRevenue"),
          money(stats.totals.revenue),
          stats.totals.revenue,
        ],
        ...(totals.length > 0
          ? totals.map((one) => [
              totals.length > 1
                ? t("reports.earnedIn", { code: one.currencyCode })
                : t("reports.earned"),
              moneyIn(one.amount, one.currencyCode),
              one.amount,
            ])
          : [[t("reports.earned"), money(0), 0]]),
        [
          t("reports.tileOrders"),
          String(stats.totals.orders),
          stats.totals.orders,
        ],
        [
          t("reports.tileAverage"),
          money(stats.totals.averageOrder),
          stats.totals.averageOrder,
        ],
        [
          t("reports.tileDelivery"),
          money(stats.totals.deliveryFees),
          stats.totals.deliveryFees,
        ],
        [
          t("reports.discountsGiven"),
          money(stats.totals.discounts),
          stats.totals.discounts,
        ],
        [
          t("reports.colCancelled"),
          String(stats.totals.cancelled),
          stats.totals.cancelled,
        ],
      ],
    },
    {
      name: t("reports.sheetDaily"),
      rows: [
        [
          t("reports.colDay"),
          t("reports.colOrders"),
          t("reports.colRevenue"),
          t("reports.colRaw"),
        ],
        ...stats.daily.map((day) => [
          day.day,
          day.orders,
          money(day.revenue),
          day.revenue,
        ]),
      ],
    },
    {
      name: t("reports.sheetItems"),
      rows: [
        [
          t("reports.colItem"),
          t("reports.colQuantity"),
          t("reports.colRevenue"),
          t("reports.colRaw"),
        ],
        ...stats.topItems.map((item) => [
          nameOf(item.name),
          item.quantity,
          money(item.revenue),
          item.revenue,
        ]),
      ],
    },
    {
      name: t("reports.sheetStores"),
      rows: [
        [
          t("reports.colStore"),
          t("reports.colOrders"),
          t("reports.colRevenue"),
          t("reports.colRaw"),
          t("reports.earnedColumn"),
        ],
        ...stats.topStores.map((store) => [
          nameOf(store.name),
          store.orders,
          money(store.revenue),
          store.revenue,
          earnedText(perStore.get(store.storeId), moneyIn),
        ]),
      ],
    },
    {
      name: t("reports.sheetHours"),
      rows: [
        [t("reports.colWeekday"), t("reports.colHour"), t("reports.colOrders")],
        ...stats.hourly.map((bucket) => [
          WEEKDAYS[bucket.dayOfWeek] ?? String(bucket.dayOfWeek),
          `${String(bucket.hour).padStart(2, "0")}:00`,
          bucket.orders,
        ]),
      ],
    },
  ];
}

/** Sunday-first, as the data is. The chart rotates for reading; a file does not. */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A localised name, or a plain one. `topItems` and `topStores` carry jsonb. */
function nameOf(value: Record<string, string> | string): string {
  if (typeof value === "string") return value;
  return value?.en ?? Object.values(value ?? {})[0] ?? "";
}

export async function exportReport(
  format: ExportFormat,
  stats: Stats,
  currency: Currency | undefined,
  range: { from: string; to: string },
  earned?: EarnedForExport,
): Promise<void> {
  await writeSheets(format, sheets(stats, currency, earned), "report", range);
}

/**
 * Hands over a set of named tables as one file — shared with the earnings
 * report (`features/earnings/export.ts`), so the two files read alike.
 */
export async function writeSheets(
  format: ExportFormat,
  tables: Sheet[],
  what: string,
  range: { from: string; to: string },
): Promise<void> {
  if (format === "csv") {
    // One file, with each table under its own heading and a blank line
    // between. CSV has no concept of a sheet, and five separate downloads for
    // one report is worse than one file somebody scrolls.
    const rows: (string | number)[][] = [];
    for (const sheet of tables) {
      rows.push([sheet.name], ...sheet.rows, []);
    }
    download(reportFilename(what, range.from, range.to, "csv"), toCsv(rows));
    return;
  }

  if (format === "xlsx") {
    // Imported here rather than at the top of the file: `exceljs` is large, and
    // a dashboard that loads a spreadsheet writer on every page view pays for a
    // button most operators press about never.
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();

    for (const sheet of tables) {
      const worksheet = workbook.addWorksheet(sheet.name);
      worksheet.addRows(sheet.rows);
      worksheet.getRow(1).font = { bold: true };
      // Enough width to read a dish's name without opening every cell.
      worksheet.columns.forEach((column) => {
        column.width = 22;
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    download(
      reportFilename(what, range.from, range.to, "xlsx"),
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    return;
  }
}
