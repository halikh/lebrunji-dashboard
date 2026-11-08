import { describe, expect, it } from "vitest";

import { toMajor, toMinor } from "@/lib/minor-units";

import {
  combinePrice,
  resolveBranchEntry,
  splitPrice,
  withShopPrice,
} from "./markup-price";

/**
 * Markup typed as the shop's price plus ours (user, 2026-11-08). The app price
 * and the store price are what is stored; the markup is their difference and
 * is never written, so splitting and combining have to be exact inverses.
 */
describe("splitPrice", () => {
  it("is the store price and the difference, in minor units", () => {
    // $11.00 in the app, $9.00 to the shop.
    expect(splitPrice(1100, 900)).toEqual({ shopPrice: 900, markup: 200 });
  });

  it("reads no store price as the whole price to the shop, no markup", () => {
    expect(splitPrice(1100, null)).toEqual({ shopPrice: 1100, markup: 0 });
  });

  it("starts both boxes empty on a new dish", () => {
    expect(splitPrice(null, 900)).toEqual({ shopPrice: null, markup: null });
    expect(splitPrice(null, null)).toEqual({ shopPrice: null, markup: null });
  });

  it("works for lira, which has no decimals", () => {
    expect(splitPrice(450_000, 400_000)).toEqual({
      shopPrice: 400_000,
      markup: 50_000,
    });
  });
});

describe("combinePrice", () => {
  it("adds our markup to the shop's price", () => {
    expect(combinePrice({ shopPrice: 900, markup: 200 })).toEqual({
      kind: "split",
      price: 1100,
      storePrice: 900,
    });
  });

  it("is exact for cents typed as said", () => {
    const shop = toMinor("8.99", 2) as number;
    const markup = toMinor("2.01", 2) as number;
    const combined = combinePrice({ shopPrice: shop, markup });
    expect(combined.kind === "split" && toMajor(combined.price, 2)).toBe(
      "11.00",
    );
  });

  it("is exact for lira, with no decimals", () => {
    const shop = toMinor("400000", 0) as number;
    const markup = toMinor("50000", 0) as number;
    expect(combinePrice({ shopPrice: shop, markup })).toEqual({
      kind: "split",
      price: 450_000,
      storePrice: 400_000,
    });
  });

  it("allows a markup of nothing, and a free choice", () => {
    expect(combinePrice({ shopPrice: 900, markup: 0 })).toEqual({
      kind: "split",
      price: 900,
      storePrice: 900,
    });
    expect(combinePrice({ shopPrice: 0, markup: 0 })).toEqual({
      kind: "split",
      price: 0,
      storePrice: 0,
    });
  });

  it("needs both even when both are empty", () => {
    expect(combinePrice({ shopPrice: null, markup: null })).toEqual({
      kind: "invalid",
      problem: "earnings.bothNeeded",
    });
  });

  it("needs both or neither", () => {
    expect(combinePrice({ shopPrice: 900, markup: null })).toEqual({
      kind: "invalid",
      problem: "earnings.bothNeeded",
    });
    expect(combinePrice({ shopPrice: null, markup: 200 })).toEqual({
      kind: "invalid",
      problem: "earnings.bothNeeded",
    });
  });

  it("refuses selling at a loss", () => {
    expect(combinePrice({ shopPrice: 900, markup: -1 })).toEqual({
      kind: "invalid",
      problem: "earnings.markupNegative",
    });
  });

  it("undoes splitPrice", () => {
    for (const [price, store] of [
      [1100, 900],
      [450_000, 400_000],
      [0, 0],
    ] as const) {
      expect(combinePrice(splitPrice(price, store))).toEqual({
        kind: "split",
        price,
        storePrice: store,
      });
    }
  });
});

describe("withShopPrice", () => {
  it("keeps our markup when the shop's price changes", () => {
    // $9 + $2: the shop now charges $9.50, so the app price is $11.50.
    expect(withShopPrice(950, { price: 1100, storePrice: 900 })).toEqual({
      price: 1150,
      markup: 200,
    });
  });

  it("keeps the app price when the shop's price is given for the first time", () => {
    expect(withShopPrice(900, { price: 1100, storePrice: null })).toEqual({
      price: 1100,
      markup: 200,
    });
  });

  it("refuses a first shop price above the app price", () => {
    expect(withShopPrice(1200, { price: 1100, storePrice: null })).toBeNull();
  });

  it("works for lira", () => {
    expect(
      withShopPrice(420_000, { price: 450_000, storePrice: 400_000 }),
    ).toEqual({ price: 470_000, markup: 50_000 });
  });
});

describe("resolveBranchEntry", () => {
  const shop = { price: 1100, storePrice: 900 };

  it("follows the shop with both boxes empty", () => {
    expect(resolveBranchEntry({ shopPrice: null, markup: null }, shop)).toEqual(
      { kind: "follow" },
    );
  });

  it("adds the branch's own two figures", () => {
    expect(resolveBranchEntry({ shopPrice: 950, markup: 250 }, shop)).toEqual({
      kind: "split",
      price: 1200,
      storePrice: 950,
    });
  });

  it("takes the shop's markup when that box is empty", () => {
    expect(resolveBranchEntry({ shopPrice: 950, markup: null }, shop)).toEqual({
      kind: "split",
      price: 1150,
      storePrice: 950,
    });
  });

  it("takes the shop's price from the shop when that box is empty", () => {
    // The branch keeps no row of its own for it.
    expect(resolveBranchEntry({ shopPrice: null, markup: 300 }, shop)).toEqual({
      kind: "split",
      price: 1200,
      storePrice: null,
    });
  });

  it("needs both when the shop has nothing to fall back on", () => {
    expect(
      resolveBranchEntry(
        { shopPrice: 400_000, markup: null },
        { price: null, storePrice: null },
      ),
    ).toEqual({ kind: "invalid", problem: "earnings.bothNeeded" });
  });

  it("works in lira, with no decimals", () => {
    expect(
      resolveBranchEntry(
        { shopPrice: 400_000, markup: 50_000 },
        { price: null, storePrice: null },
      ),
    ).toEqual({ kind: "split", price: 450_000, storePrice: 400_000 });
  });

  it("refuses a markup below zero", () => {
    expect(resolveBranchEntry({ shopPrice: 900, markup: -100 }, shop)).toEqual({
      kind: "invalid",
      problem: "earnings.markupNegative",
    });
  });
});
