"use client";

import { download, reportFilename, toCsv } from "@/lib/download";
import { t } from "@/i18n/translations";
import { formatMoney, type Currency } from "@/lib/money";

import type { Stats } from "./api/stats";

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

export type ExportFormat = "csv" | "xlsx" | "pdf";

type Sheet = { name: string; rows: (string | number)[][] };

/**
 * The report as a set of named tables.
 *
 * Built once and handed to whichever writer was asked for, so the three formats
 * cannot disagree about what the report contains — which they would within a
 * week if each assembled its own.
 */
function sheets(stats: Stats, currency: Currency | undefined): Sheet[] {
  const money = (minor: number) =>
    currency ? formatMoney(minor, currency) : String(minor);

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
        ],
        ...stats.topStores.map((store) => [
          nameOf(store.name),
          store.orders,
          money(store.revenue),
          store.revenue,
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
): Promise<void> {
  const tables = sheets(stats, currency);

  if (format === "csv") {
    // One file, with each table under its own heading and a blank line
    // between. CSV has no concept of a sheet, and five separate downloads for
    // one report is worse than one file somebody scrolls.
    const rows: (string | number)[][] = [];
    for (const sheet of tables) {
      rows.push([sheet.name], ...sheet.rows, []);
    }
    download(
      reportFilename("report", range.from, range.to, "csv"),
      toCsv(rows),
    );
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
      reportFilename("report", range.from, range.to, "xlsx"),
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    return;
  }

  printPdf(tables, range);
}

/**
 * A PDF, via the browser's own print dialogue.
 *
 * ## Why not a PDF library
 *
 * `jspdf` and friends are hundreds of kilobytes and each brings its own font
 * handling — and this report has **Arabic** in it, which is where every
 * lightweight PDF library falls down: right-to-left runs and glyph shaping are
 * exactly what they skip. A browser already does both correctly, has the fonts,
 * and offers "Save as PDF" in every print dialogue on every platform.
 *
 * The cost is honest and worth stating: the operator gets a print dialogue
 * rather than a file appearing. That is one extra step, in exchange for a
 * document whose Arabic is not mangled.
 *
 * The window is written to and printed, not left behind — an orphan tab full of
 * a report is litter.
 */
function printPdf(tables: Sheet[], range: { from: string; to: string }) {
  const win = window.open("", "_blank");
  if (!win) {
    // Blocked by a popup blocker. Nothing to do but say so; silently doing
    // nothing is the failure people report as "the button is broken".
    throw new Error(t("reports.printBlocked"));
  }

  const escape = (value: string | number) =>
    String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;");

  const body = tables
    .map(
      (sheet) => `
        <h2>${escape(sheet.name)}</h2>
        <table>
          <thead><tr>${sheet.rows[0]?.map((cell) => `<th>${escape(cell)}</th>`).join("") ?? ""}</tr></thead>
          <tbody>
            ${sheet.rows
              .slice(1)
              .map(
                (row) =>
                  `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}</tr>`,
              )
              .join("")}
          </tbody>
        </table>`,
    )
    .join("");

  win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${escape(t("reports.title"))} ${escape(range.from)} — ${escape(range.to)}</title>
<style>
  body { font: 13px/1.5 system-ui, sans-serif; margin: 24px; color: #1e1b18; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 24px 0 8px; }
  p { color: #5c554e; margin: 0 0 8px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid #ece4d9; padding: 6px 8px; text-align: start; }
  th { font-weight: 600; }
  /* A section is not split across a page break where it can be helped. */
  h2, table { break-inside: avoid; }
</style></head>
<body>
  <h1>${escape(t("reports.title"))}</h1>
  <p>${escape(range.from)} — ${escape(range.to)}</p>
  ${body}
</body></html>`);

  win.document.close();
  win.focus();
  win.print();
  win.close();
}
