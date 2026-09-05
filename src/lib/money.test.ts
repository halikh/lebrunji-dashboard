import { describe, expect, it } from "vitest";

import { restatePrice, type ConvertibleCurrency } from "./money";

/**
 * Restating a shop's prices when its currency changes — migration 0097.
 *
 * This is the arithmetic behind a preview the operator is asked to trust before
 * an irreversible write. If it disagrees with `api_v1_set_store_currency` by so
 * much as a digit, the screen is not a preview but a promise the database will
 * break — so the cases below are the ones checked against the real function on
 * the real data: 1200 → 12 → 1,076,400, and 550 → 6.
 *
 * The failure mode is silent in the worst way. Nothing errors; a menu simply
 * becomes wrong by a factor of a hundred, or of the exchange rate, and looks
 * entirely plausible either way.
 */

const USD: ConvertibleCurrency = {
  code: "USD",
  symbol: "$",
  symbolPosition: "before",
  decimalDigits: 2,
  decimalSeparator: ".",
  groupSeparator: ",",
  rate: 1,
  isBase: true,
};

const LBP: ConvertibleCurrency = {
  code: "LBP",
  symbol: "ل.ل",
  symbolPosition: "after",
  decimalDigits: 0,
  decimalSeparator: ".",
  groupSeparator: ",",
  rate: 89_700,
};

describe("restatePrice — keep", () => {
  it("keeps the number the merchant typed", () => {
    // The case the feature exists for: the shop was set to USD by mistake and
    // `12` was typed meaning twelve lira.
    expect(restatePrice(1200, USD, LBP, "keep")).toBe(12);
  });

  it("puts the decimals back going the other way", () => {
    expect(restatePrice(12, LBP, USD, "keep")).toBe(1200);
  });

  it("is a round trip when nothing is lost", () => {
    const there = restatePrice(1200, USD, LBP, "keep");
    expect(restatePrice(there, LBP, USD, "keep")).toBe(1200);
  });

  it("loses the subunit when the new currency has none", () => {
    // $12.34 has nowhere to put its 34 cents in a currency with no subunit.
    // Documented, warned about, and not recoverable — coming back gives $12.00.
    const there = restatePrice(1234, USD, LBP, "keep");
    expect(there).toBe(12);
    expect(restatePrice(there, LBP, USD, "keep")).toBe(1200);
  });

  it("rounds half away from zero, as the database does", () => {
    // $5.50 -> 6, matching Postgres `round(5.5)`. A preview that said 5 while
    // the write produced 6 is the exact disagreement this test exists to stop.
    expect(restatePrice(550, USD, LBP, "keep")).toBe(6);
    expect(restatePrice(1250, USD, LBP, "keep")).toBe(13);
  });

  it("leaves a free choice free", () => {
    expect(restatePrice(0, USD, LBP, "keep")).toBe(0);
  });

  it("does nothing when the currency has not moved", () => {
    expect(restatePrice(1200, USD, USD, "keep")).toBe(1200);
  });
});

describe("restatePrice — convert", () => {
  it("keeps what the dish is worth", () => {
    expect(restatePrice(1200, USD, LBP, "convert")).toBe(1_076_400);
  });

  it("comes back to the same money", () => {
    const there = restatePrice(1200, USD, LBP, "convert");
    expect(restatePrice(there, LBP, USD, "convert")).toBe(1200);
  });

  it("differs from keep by the whole exchange rate", () => {
    // The reason the operator is asked which one they mean, rather than being
    // given a default: these two answers are ~89,700 apart.
    const kept = restatePrice(1200, USD, LBP, "keep");
    const converted = restatePrice(1200, USD, LBP, "convert");
    expect(converted / kept).toBe(89_700);
  });

  it("leaves a free choice free", () => {
    expect(restatePrice(0, USD, LBP, "convert")).toBe(0);
  });
});
