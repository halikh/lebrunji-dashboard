import { describe, expect, it } from "vitest";

import {
  asPriceUnit,
  itemUnit,
  linePrice,
  pricePerUnit,
  unitAmount,
} from "./units";

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

describe("linePrice", () => {
  const perKilo = { unit: "kg", quantity: 1, step: 0.5 } as const;

  it("is the price times the count when nothing is stepped", () => {
    // Every item on the menu before `0122`, and every pack since.
    const pack = { unit: "g", quantity: 500, step: null } as const;
    expect(linePrice(1200, 0, pack, 1)).toBe(1200);
    expect(linePrice(1200, 0, pack, 3)).toBe(3600);
    expect(linePrice(1200, 0, null, 3)).toBe(3600);
  });

  it("charges a stepped line in proportion to the amount", () => {
    // $12.00 the kilo, moving by 500 g: the example `0122` is written around.
    expect(linePrice(1200, 0, perKilo, 1)).toBe(1200); // 1 kg
    expect(linePrice(1200, 0, perKilo, 2)).toBe(1800); // 1.5 kg
    expect(linePrice(1200, 0, perKilo, 3)).toBe(2400); // 2 kg
  });

  it("handles a step that is a quarter of the unit", () => {
    // "$12.00, and $3.00 for the 0.25".
    const quarters = { unit: "kg", quantity: 1, step: 0.25 } as const;
    expect(linePrice(1200, 0, quarters, 2)).toBe(1500); // 1.25 kg
    expect(linePrice(1200, 0, quarters, 3)).toBe(1800); // 1.5 kg
  });

  it("is proportional from a starting amount that is not one unit", () => {
    // Half a kilo at $6.00 is the same rate — $12.00 the kilo — read from the
    // other end, which is what "0.5 is 6" means.
    const half = { unit: "kg", quantity: 0.5, step: 0.5 } as const;
    expect(linePrice(600, 0, half, 1)).toBe(600);
    expect(linePrice(600, 0, half, 2)).toBe(1200);
  });

  it("keeps the floor at the starting amount", () => {
    // `0119`'s "we sell from five kilos". A count below one press is still one.
    const fromFive = { unit: "kg", quantity: 5, step: 5 } as const;
    expect(linePrice(1000, 0, fromFive, 0)).toBe(1000);
    expect(linePrice(1000, 0, fromFive, 2)).toBe(2000);
  });

  it("adds the options once on a stepped line and per press otherwise", () => {
    // A $1.00 vacuum pack is done once to 2 kg of meat, and once to each of
    // three packs.
    expect(linePrice(1300, 100, perKilo, 3)).toBe(2500); // 2 kg + $1.00
    const pack = { unit: "g", quantity: 500, step: null } as const;
    expect(linePrice(1300, 100, pack, 3)).toBe(3900);
  });

  it("rounds the amount before it multiplies", () => {
    // 0.1 + 0.2 is not 0.3 in binary, and `numeric(10, 3)` is the whole
    // precision the columns have — so the amount is rounded first, in both
    // this and `line_price`. Without it the third press is 0.30000000000000004
    // of a litre and the money drifts a minor unit.
    const tenths = { unit: "l", quantity: 0.1, step: 0.1 } as const;
    expect(linePrice(1000, 0, tenths, 3)).toBe(3000);
  });

  it("falls back to a multiple when the quantity cannot be divided by", () => {
    // `0095` refuses this from the database; an `ItemUnit` built by hand can
    // still hold it, and an Infinity reaching the money would be worse.
    const broken = { unit: "kg", quantity: 0, step: 1 } as const;
    expect(linePrice(1200, 0, broken, 2)).toBe(2400);
  });
});
