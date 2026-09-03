import { describe, expect, it } from "vitest";

import { asPriceUnit, itemUnit, pricePerUnit } from "./units";

describe("itemUnit", () => {
  it("is null unless both columns are there", () => {
    expect(itemUnit({ priceUnit: null, unitQuantity: null })).toBeNull();
    expect(itemUnit({ priceUnit: "kg", unitQuantity: null })).toBeNull();
    expect(itemUnit({ priceUnit: null, unitQuantity: 1 })).toBeNull();
  });

  it("refuses a quantity that cannot be divided by", () => {
    expect(itemUnit({ priceUnit: "kg", unitQuantity: 0 })).toBeNull();
    expect(itemUnit({ priceUnit: "kg", unitQuantity: -1 })).toBeNull();
  });

  it("reads a unit the vocabulary does not know as no unit", () => {
    expect(itemUnit({ priceUnit: "furlong", unitQuantity: 1 })).toBeNull();
  });

  it("returns the pair when both are good", () => {
    expect(itemUnit({ priceUnit: "g", unitQuantity: 500 })).toEqual({
      unit: "g",
      quantity: 500,
    });
  });
});

describe("pricePerUnit", () => {
  it("quotes grams per kilo, so two sizes are comparable", () => {
    // The point of the whole file: these are the same value, said twice.
    const kilo = pricePerUnit(1200, { unit: "kg", quantity: 1 });
    const half = pricePerUnit(600, { unit: "g", quantity: 500 });

    expect(kilo).toEqual({ amount: 1200, unit: "kg" });
    expect(half).toEqual({ amount: 1200, unit: "kg" });
  });

  it("quotes millilitres per litre", () => {
    expect(pricePerUnit(250, { unit: "ml", quantity: 330 })).toEqual({
      amount: 758,
      unit: "l",
    });
  });

  it("says nothing about a single piece", () => {
    // "$12.00 per piece" beside "$12.00" is the same number twice.
    expect(pricePerUnit(1200, { unit: "piece", quantity: 1 })).toBeNull();
  });

  it("but does quote a multi-piece pack", () => {
    expect(pricePerUnit(1200, { unit: "piece", quantity: 6 })).toEqual({
      amount: 200,
      unit: "piece",
    });
  });

  it("rounds once, to whole minor units", () => {
    // 1000 / 3 is 333.33…; a fraction of a cent is not a thing a column holds.
    const per = pricePerUnit(1000, { unit: "kg", quantity: 3 });
    expect(per).toEqual({ amount: 333, unit: "kg" });
    expect(Number.isInteger(per?.amount)).toBe(true);
  });

  it("works for a currency with no minor unit", () => {
    // 89,000 lira for 500 g is 178,000 the kilo — no decimals anywhere.
    expect(pricePerUnit(89000, { unit: "g", quantity: 500 })).toEqual({
      amount: 178000,
      unit: "kg",
    });
  });
});

describe("asPriceUnit", () => {
  it("narrows a known value and rejects everything else", () => {
    expect(asPriceUnit("kg")).toBe("kg");
    expect(asPriceUnit("KG")).toBeNull();
    expect(asPriceUnit(null)).toBeNull();
    expect(asPriceUnit(1)).toBeNull();
  });
});
