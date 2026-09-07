import { describe, expect, it } from "vitest";

import { asPriceUnit, itemUnit, pricePerUnit, unitAmount } from "./units";

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
      // Absent on the row, and absent is the plain whole-item stepper.
      step: null,
    });
  });

  it("carries a step through when there is one", () => {
    expect(
      itemUnit({ priceUnit: "kg", unitQuantity: 5, unitStep: 5 }),
    ).toEqual({ unit: "kg", quantity: 5, step: 5 });
  });

  it("drops a step that cannot move", () => {
    // `0119`'s CHECK refuses these, so this is about an item built by hand —
    // a `+` that does nothing is worse than no `+` at all.
    expect(itemUnit({ priceUnit: "kg", unitQuantity: 5, unitStep: 0 })?.step)
      .toBeNull();
    expect(itemUnit({ priceUnit: "kg", unitQuantity: 5, unitStep: -1 })?.step)
      .toBeNull();
  });
});

describe("unitAmount", () => {
  it("walks from the starting amount, by the step", () => {
    // The case this was built for: five kilos minimum, five at a time.
    const unit = { unit: "kg", quantity: 5, step: 5 } as const;
    expect(unitAmount(unit, 1)).toBe(5);
    expect(unitAmount(unit, 2)).toBe(10);
    expect(unitAmount(unit, 3)).toBe(15);
  });

  it("starts at the starting amount and will not go below it", () => {
    const unit = { unit: "kg", quantity: 5, step: 5 } as const;
    expect(unitAmount(unit, 0)).toBe(5);
    expect(unitAmount(unit, -3)).toBe(5);
  });

  it("steps by something other than the starting amount", () => {
    // From 5 kg, two at a time: 5, 7, 9.
    const unit = { unit: "kg", quantity: 5, step: 2 } as const;
    expect(unitAmount(unit, 3)).toBe(9);
  });

  it("multiplies packs when there is no step", () => {
    // Falls out of the same expression rather than being a second branch:
    // three 500 g packs are 1500 g.
    const unit = { unit: "g", quantity: 500, step: null } as const;
    expect(unitAmount(unit, 3)).toBe(1500);
  });

  it("does not accumulate binary noise", () => {
    // 0.1 + 0.1 + 0.1 is 0.30000000000000004 in IEEE 754, and "0.3 kg" is
    // what a person weighing something out expects to read.
    const unit = { unit: "kg", quantity: 0.1, step: 0.1 } as const;
    expect(unitAmount(unit, 3)).toBe(0.3);
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
