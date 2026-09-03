import { describe, expect, it } from "vitest";

import { bulkPlaceholder, parseBulkRows } from "./bulk-entry";

const CODES = ["en", "ar"];

/** The shop currency's decimals. Two for USD, zero for a currency without. */
const USD = 2;
const LBP = 0;

describe("parseBulkRows", () => {
  it("reads a name per language and an optional price", () => {
    const result = parseBulkRows(
      ["Small | صغير", "Medium | وسط | 1.50", "Large | كبير | 3"].join("\n"),
      CODES,
      USD,
      "optional",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([
      { name: { en: "Small", ar: "صغير" }, price: 0 },
      { name: { en: "Medium", ar: "وسط" }, price: 150 },
      { name: { en: "Large", ar: "كبير" }, price: 300 },
    ]);
  });

  it("scales by the currency, so 3 is three units and never three cents", () => {
    const usd = parseBulkRows("Large | كبير | 3", CODES, USD, "optional");
    const lbp = parseBulkRows("Large | كبير | 89000", CODES, LBP, "optional");

    expect(usd.ok && usd.rows[0].price).toBe(300);
    expect(lbp.ok && lbp.rows[0].price).toBe(89000);
  });

  it("refuses every priced line when the currency is not known yet", () => {
    const result = parseBulkRows("Large | كبير | 3", CODES, null, "optional");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].key).toBe("bulk.price");
  });

  it("skips blank lines rather than reporting them", () => {
    const result = parseBulkRows(
      "\nSmall | صغير\n\n  \nLarge | كبير\n",
      CODES,
      USD,
      "optional",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
  });

  it("names the line and the language when a name is missing", () => {
    const result = parseBulkRows("Small |   | 1", CODES, USD, "optional");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toEqual([
      { line: 1, key: "bulk.nameMissing", params: { code: "AR" } },
    ]);
  });

  it("reports the wrong number of columns against the languages there are", () => {
    const result = parseBulkRows("Small", CODES, USD, "optional");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]).toMatchObject({
      line: 1,
      key: "bulk.columns",
      params: { expected: 2, found: 1 },
    });
  });

  it("catches a list pasted twice, and says which line it first appeared on", () => {
    const result = parseBulkRows(
      ["Small | صغير", "Large | كبير", "small | صغير"].join("\n"),
      CODES,
      USD,
      "optional",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]).toMatchObject({
      line: 3,
      key: "bulk.duplicate",
      params: { first: 1 },
    });
  });

  it("rejects a price that is not a number", () => {
    const result = parseBulkRows("Small | صغير | free", CODES, USD, "optional");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].key).toBe("bulk.price");
  });

  it("rejects a negative price and one past the fat-finger ceiling", () => {
    const negative = parseBulkRows("Small | صغير | -1", CODES, USD, "optional");
    const huge = parseBulkRows(
      "Small | صغير | 99999999",
      CODES,
      USD,
      "optional",
    );

    expect(negative.ok).toBe(false);
    expect(huge.ok).toBe(false);
  });

  it("creates nothing when any line fails", () => {
    const result = parseBulkRows(
      ["Small | صغير", "Medium", "Large | كبير"].join("\n"),
      CODES,
      USD,
      "optional",
    );

    // Two lines are perfectly good and neither is returned: a partial insert
    // would leave the operator unable to re-paste without duplicating.
    expect(result.ok).toBe(false);
  });

  it("takes a third language as a third column, without being told", () => {
    const result = parseBulkRows(
      "Small | صغير | Petit | 1",
      ["en", "ar", "fr"],
      USD,
      "optional",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toEqual({
      name: { en: "Small", ar: "صغير", fr: "Petit" },
      price: 100,
    });
  });

  it("keeps a name containing a comma in one piece", () => {
    const result = parseBulkRows(
      "Salt, pepper & herbs | بهارات",
      CODES,
      USD,
      "optional",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].name.en).toBe("Salt, pepper & herbs");
  });
});

describe("bulkPlaceholder", () => {
  it("shows one column per language, in the order given", () => {
    const lines = bulkPlaceholder(CODES, "optional").split("\n");

    expect(lines[0]).toBe("Small | صغير");
    expect(lines[1]).toBe("Medium | وسط | 1.50");
  });

  it("parses back — the example is never an instruction that fails", () => {
    for (const codes of [CODES, ["en", "ar", "fr"]]) {
      expect(
        parseBulkRows(
          bulkPlaceholder(codes, "optional"),
          codes,
          USD,
          "optional",
        ).ok,
      ).toBe(true);
    }
  });
});

describe("price rules", () => {
  it("sections take names only, and refuse a stray price column", () => {
    const ok = parseBulkRows("Starters | المقبلات", CODES, USD, "none");
    const extra = parseBulkRows("Starters | المقبلات | 3", CODES, USD, "none");

    expect(ok.ok).toBe(true);
    if (ok.ok)
      expect(ok.rows[0]).toEqual({
        name: { en: "Starters", ar: "المقبلات" },
        price: null,
      });
    expect(extra.ok).toBe(false);
  });

  it("items must carry a price, unlike choices", () => {
    const missing = parseBulkRows("Hummus | حمص", CODES, USD, "required");
    const given = parseBulkRows("Hummus | حمص | 4", CODES, USD, "required");

    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.problems[0].key).toBe("bulk.columns");
    expect(given.ok && given.rows[0].price).toBe(400);
  });

  it("builds an example per kind that parses back under its own rule", () => {
    const kinds = [
      ["sections", "none"],
      ["items", "required"],
      ["choices", "optional"],
    ] as const;

    for (const [kind, rule] of kinds) {
      const example = bulkPlaceholder(CODES, rule, kind);
      expect(parseBulkRows(example, CODES, USD, rule).ok).toBe(true);
    }
  });
});
