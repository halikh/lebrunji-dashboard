import { describe, expect, it } from "vitest";

import { quoteDelivery } from "./quote";

const ladder = [
  { upToKm: 6, amount: 300 },
  { upToKm: 3, amount: 200 },
  { upToKm: 10, amount: 450 },
];

describe("quoteDelivery", () => {
  it("charges the first band at or above the distance", () => {
    expect(quoteDelivery(ladder, 2.4, 1, 50)).toMatchObject({
      kind: "priced",
      total: 200,
    });
    // `<=`, as `delivery_fee_for_km` reads it.
    expect(quoteDelivery(ladder, 3, 1, 50)).toMatchObject({ total: 200 });
    expect(quoteDelivery(ladder, 3.01, 1, 50)).toMatchObject({ total: 300 });
  });

  it("refuses past the top band rather than charging it", () => {
    expect(quoteDelivery(ladder, 10.5, 1, 50)).toEqual({
      kind: "out",
      radiusKm: 10,
    });
  });

  it("adds the stop fee for every shop after the first", () => {
    expect(quoteDelivery(ladder, 5, 3, 50)).toMatchObject({
      ride: 300,
      stops: 100,
      total: 400,
    });
  });

  it("has nothing to say without bands or a distance", () => {
    expect(quoteDelivery([], 2, 1, 0)).toEqual({ kind: "none" });
    expect(quoteDelivery(ladder, Number.NaN, 1, 0)).toEqual({ kind: "none" });
  });
});
