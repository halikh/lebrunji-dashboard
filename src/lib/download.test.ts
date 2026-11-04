import { describe, expect, it } from "vitest";

import { reportFilename, toCsv } from "./download";

/**
 * The CSV export (QA-058).
 *
 * Every rule here fails silently: a comma splits a dish into two columns, a
 * missing BOM turns Arabic into mojibake, and a merchant's dish name that
 * starts with `=` runs as a formula on the operator's machine. Nothing in the
 * dashboard shows any of it — only the file does.
 */

const BOM = "﻿";

/**
 * The file's text, BOM and all. `Blob.text()` would decode the BOM away and
 * hide whether it is there.
 */
const csv = async (rows: (string | number)[][]) =>
  new TextDecoder("utf-8", { ignoreBOM: true }).decode(
    await toCsv(rows).arrayBuffer(),
  );

describe("toCsv", () => {
  it("starts with a byte-order mark and ends rows with CRLF", async () => {
    expect(
      await csv([
        ["a", "b"],
        ["c", "d"],
      ]),
    ).toBe(`${BOM}a,b\r\nc,d`);
  });

  it("is UTF-8 text/csv", () => {
    expect(toCsv([["a"]]).type).toBe("text/csv;charset=utf-8");
  });

  it("writes numbers bare, negative ones included", async () => {
    expect(await csv([[1200, -350, 0.5]])).toBe(`${BOM}1200,-350,0.5`);
  });

  it("quotes a field with a comma, a quote or a line break", async () => {
    expect(
      await csv([["Kibbeh, large", 'The "big" one', "two\nlines", "cr\rlf"]]),
    ).toBe(`${BOM}"Kibbeh, large","The ""big"" one","two\nlines","cr\rlf"`);
  });

  it("keeps Arabic as it is", async () => {
    expect(await csv([["كبة"]])).toBe(`${BOM}كبة`);
  });

  it("writes an empty row as an empty line", async () => {
    expect(await csv([["Items"], [], ["Stores"]])).toBe(
      `${BOM}Items\r\n\r\nStores`,
    );
  });

  describe("formula injection", () => {
    it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\t=1", "\r=1"])(
      "defuses text starting %j",
      async (name) => {
        const text = await csv([[name]]);
        // A leading `'` either bare or just inside the quotes.
        expect(text.slice(BOM.length).replace(/^"/, "")).toMatch(/^'/);
      },
    );

    it("defuses a formula and still quotes it when it needs quoting", async () => {
      expect(await csv([['=HYPERLINK("http://x","Kibbeh")']])).toBe(
        `${BOM}"'=HYPERLINK(""http://x"",""Kibbeh"")"`,
      );
    });

    it("leaves ordinary text alone, including symbols past the first character", async () => {
      expect(await csv([["Kafta", "1+1 deal", "a@b", "$-5.00"]])).toBe(
        `${BOM}Kafta,1+1 deal,a@b,$-5.00`,
      );
    });
  });
});

describe("reportFilename", () => {
  it("names the report, the range and the type", () => {
    expect(reportFilename("report", "2026-08-01", "2026-08-31", "csv")).toBe(
      "report-2026-08-01-to-2026-08-31.csv",
    );
  });
});
