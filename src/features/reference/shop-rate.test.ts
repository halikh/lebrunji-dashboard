import { describe, expect, it } from "vitest";

import { oneShopRate } from "./shop-rate";

/**
 * Which rate an order is read at — migration 0120.
 *
 * The rule has to be identical here, on the order panel, in a customer's
 * history and in the app, because all four show the *same order's total*. Two
 * of them disagreeing puts two different lira figures on one receipt, and the
 * operator reading one of them aloud has no way to tell which.
 */

/** One portion, shaped the way every caller's `order_stores` embed arrives. */
function portion(storeId: string, rate: string | number | null) {
  return { store_id: storeId, stores: { exchange_rate: rate } };
}

describe("oneShopRate", () => {
  it("takes the shop's rate when the order is from one shop", () => {
    expect(oneShopRate([portion("s1", "90000")])).toBe(90_000);
  });

  it("parses the numeric PostgREST sends as a string", () => {
    expect(oneShopRate([portion("s1", "90000.500000")])).toBe(90_000.5);
  });

  it("falls back to the platform's across two shops", () => {
    // Two shops quoting two rates give a total no single rate is right for.
    expect(oneShopRate([portion("s1", "90000"), portion("s2", "95000")])).toBe(
      null,
    );
  });

  it("counts shops, not portions", () => {
    expect(oneShopRate([portion("s1", "90000"), portion("s1", "90000")])).toBe(
      90_000,
    );
  });

  it("is null for a shop that quotes none", () => {
    expect(oneShopRate([portion("s1", null)])).toBe(null);
  });

  it("is null when the query did not ask for the column", () => {
    expect(oneShopRate([{ store_id: "s1", stores: { name: "Zaatar" } }])).toBe(
      null,
    );
  });

  it("refuses a non-positive rate rather than converting through it", () => {
    expect(oneShopRate([portion("s1", 0)])).toBe(null);
    expect(oneShopRate([portion("s1", -5)])).toBe(null);
  });

  it("is null for an order with no portions at all", () => {
    expect(oneShopRate([])).toBe(null);
  });

  it("reads an embed PostgREST returned as a one-element array", () => {
    expect(
      oneShopRate([{ store_id: "s1", stores: [{ exchange_rate: "90000" }] }]),
    ).toBe(90_000);
  });
});
