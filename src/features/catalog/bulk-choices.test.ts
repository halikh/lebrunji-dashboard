import { describe, expect, it } from "vitest";

import { bulkPlaceholder, parseBulkChoices } from "./bulk-choices";

const CODES = ["en", "ar"];

/** The shop currency's decimals. Two for USD, zero for a currency without. */
const USD = 2;
const LBP = 0;

describe("parseBulkChoices", () => {
  it("reads a name per language and an optional price", () => {
    const result = parseBulkChoices(
      ["Small | صغير", "Medium | وسط | 1.50", "Large | كبير | 3"].join("\n"),
      CODES,
      USD,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choices).toEqual([
      { name: { en: "Small", ar: "صغير" }, price: 0 },
      { name: { en: "Medium", ar: "وسط" }, price: 150 },
      { name: { en: "Large", ar: "كبير" }, price: 300 },
    ]);
  });

  it("scales by the currency, so 3 is three units and never three cents", () => {
    const usd = parseBulkChoices("Large | كبير | 3", CODES, USD);
    const lbp = parseBulkChoices("Large | كبير | 89000", CODES, LBP);

    expect(usd.ok && usd.choices[0].price).toBe(300);
    expect(lbp.ok && lbp.choices[0].price).toBe(89000);
  });

  it("refuses every priced line when the currency is not known yet", () => {
    const result = parseBulkChoices("Large | كبير | 3", CODES, null);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].key).toBe("options.bulkPrice");
  });

  it("skips blank lines rather than reporting them", () => {
    const result = parseBulkChoices(
      "\nSmall | صغير\n\n  \nLarge | كبير\n",
      CODES,
      USD,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choices).toHaveLength(2);
  });

  it("names the line and the language when a name is missing", () => {
    const result = parseBulkChoices("Small |   | 1", CODES, USD);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toEqual([
      { line: 1, key: "options.bulkNameMissing", params: { code: "AR" } },
    ]);
  });

  it("reports the wrong number of columns against the languages there are", () => {
    const result = parseBulkChoices("Small", CODES, USD);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]).toMatchObject({
      line: 1,
      key: "options.bulkColumns",
      params: { expected: 2, found: 1 },
    });
  });

  it("catches a list pasted twice, and says which line it first appeared on", () => {
    const result = parseBulkChoices(
      ["Small | صغير", "Large | كبير", "small | صغير"].join("\n"),
      CODES,
      USD,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]).toMatchObject({
      line: 3,
      key: "options.bulkDuplicate",
      params: { first: 1 },
    });
  });

  it("rejects a price that is not a number", () => {
    const result = parseBulkChoices("Small | صغير | free", CODES, USD);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].key).toBe("options.bulkPrice");
  });

  it("rejects a negative price and one past the fat-finger ceiling", () => {
    const negative = parseBulkChoices("Small | صغير | -1", CODES, USD);
    const huge = parseBulkChoices("Small | صغير | 99999999", CODES, USD);

    expect(negative.ok).toBe(false);
    expect(huge.ok).toBe(false);
  });

  it("creates nothing when any line fails", () => {
    const result = parseBulkChoices(
      ["Small | صغير", "Medium", "Large | كبير"].join("\n"),
      CODES,
      USD,
    );

    // Two lines are perfectly good and neither is returned: a partial insert
    // would leave the operator unable to re-paste without duplicating.
    expect(result.ok).toBe(false);
  });

  it("takes a third language as a third column, without being told", () => {
    const result = parseBulkChoices(
      "Small | صغير | Petit | 1",
      ["en", "ar", "fr"],
      USD,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choices[0]).toEqual({
      name: { en: "Small", ar: "صغير", fr: "Petit" },
      price: 100,
    });
  });

  it("keeps a name containing a comma in one piece", () => {
    const result = parseBulkChoices("Salt, pepper & herbs | بهارات", CODES, USD);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choices[0].name.en).toBe("Salt, pepper & herbs");
  });
});

describe("bulkPlaceholder", () => {
  it("shows one column per language, in the order given", () => {
    const lines = bulkPlaceholder(CODES).split("\n");

    expect(lines[0]).toBe("Small | صغير");
    expect(lines[1]).toBe("Medium | وسط | 1.50");
  });

  it("parses back — the example is never an instruction that fails", () => {
    for (const codes of [CODES, ["en", "ar", "fr"]]) {
      expect(parseBulkChoices(bulkPlaceholder(codes), codes, USD).ok).toBe(true);
    }
  });
});
